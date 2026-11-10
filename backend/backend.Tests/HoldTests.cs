using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;

namespace backend.Tests;

[Collection("db")]
public class HoldTests(DatabaseFixture db)
{
    private readonly HttpClient _client = db.Factory.CreateClient();
    private static int _next;

    private record ClassDto(string Id, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);
    private record HoldDto(string HoldId, string ClassId, string? StudentId, string Status, DateTime ExpiresAt);
    private record MyHoldDto(string HoldId, string ClassId, string ClassName, string Status, DateTime ExpiresAt);

    private static string NewStudent() => $"2015{Interlocked.Increment(ref _next):D13}";

    private static async Task<string> CreateClassAsync(HttpClient c, int seats, string name = "Test class")
    {
        var res = await c.PostAsJsonAsync("/classes", new { name, totalSeats = seats });
        return (await res.Content.ReadFromJsonAsync<ClassDto>())!.Id;
    }

    private static HttpRequestMessage As(string? student, HttpMethod method, string url)
    {
        var msg = new HttpRequestMessage(method, url);
        if (student is not null) msg.Headers.Add("X-Student-Id", student);
        return msg;
    }

    private static Task<HttpResponseMessage> Hold(HttpClient c, string classId, string? student) =>
        c.SendAsync(As(student, HttpMethod.Post, $"/classes/{classId}/holds"));

    // The brief's mandatory concurrency test: many simultaneous requests never overbook.
    [Fact]
    public async Task Hundred_parallel_holds_on_ten_seats_never_overbook()
    {
        var classId = await CreateClassAsync(_client, 10);
        var results = await Task.WhenAll(Enumerable.Range(0, 100).Select(_ => Hold(_client, classId, NewStudent())));

        Assert.Equal(10, results.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(90, results.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        var cls = await _client.GetFromJsonAsync<ClassDto>($"/classes/{classId}");
        Assert.Equal((10, 0, 0), (cls!.HeldSeats, cls.ConfirmedSeats, cls.AvailableSeats));
    }

    [Fact]
    public async Task Same_student_parallel_holds_in_one_class_get_one_seat()
    {
        var classId = await CreateClassAsync(_client, 50);
        var student = NewStudent();
        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Hold(_client, classId, student)));

        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(9, results.Count(r => r.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task Student_can_hold_seats_in_different_classes()
    {
        var student = NewStudent();
        Assert.Equal(HttpStatusCode.Created, (await Hold(_client, await CreateClassAsync(_client, 5), student)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Hold(_client, await CreateClassAsync(_client, 5), student)).StatusCode);
    }

    [Fact]
    public async Task Parallel_confirms_count_once_and_all_return_200()
    {
        var classId = await CreateClassAsync(_client, 5);
        var student = NewStudent();
        var hold = await (await Hold(_client, classId, student)).Content.ReadFromJsonAsync<HoldDto>();
        Assert.Equal(("HELD", student, classId), (hold!.Status, hold.StudentId, hold.ClassId));
        Assert.Equal(DateTimeKind.Utc, hold.ExpiresAt.Kind);

        var results = await Task.WhenAll(Enumerable.Range(0, 10)
            .Select(_ => _client.SendAsync(As(student, HttpMethod.Post, $"/holds/{hold.HoldId}/confirm"))));
        Assert.All(results, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal("CONFIRMED", (await results[0].Content.ReadFromJsonAsync<HoldDto>())!.Status);

        var cls = await _client.GetFromJsonAsync<ClassDto>($"/classes/{classId}");
        Assert.Equal((0, 1, 4), (cls!.HeldSeats, cls.ConfirmedSeats, cls.AvailableSeats));
        // Already confirmed: cancel is not allowed, and the student can't apply again in this class.
        Assert.Equal(HttpStatusCode.Conflict, (await _client.SendAsync(As(student, HttpMethod.Delete, $"/holds/{hold.HoldId}"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Hold(_client, classId, student)).StatusCode);
    }

    [Fact]
    public async Task Cancel_frees_the_seat_and_allows_reapplying()
    {
        var classId = await CreateClassAsync(_client, 1);
        var student = NewStudent();
        var hold = await (await Hold(_client, classId, student)).Content.ReadFromJsonAsync<HoldDto>();
        Assert.Equal(HttpStatusCode.Conflict, (await Hold(_client, classId, NewStudent())).StatusCode); // full

        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(As(student, HttpMethod.Delete, $"/holds/{hold!.HoldId}"))).StatusCode);
        Assert.Equal("CANCELLED", (await _client.GetFromJsonAsync<HoldDto>($"/holds/{hold.HoldId}"))!.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await _client.SendAsync(As(student, HttpMethod.Delete, $"/holds/{hold.HoldId}"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _client.SendAsync(As(student, HttpMethod.Post, $"/holds/{hold.HoldId}/confirm"))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Hold(_client, classId, student)).StatusCode);
    }

    [Fact]
    public async Task Other_students_hold_returns_403()
    {
        var hold = await (await Hold(_client, await CreateClassAsync(_client, 5), NewStudent())).Content.ReadFromJsonAsync<HoldDto>();
        var stranger = NewStudent();
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(As(stranger, HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(As(stranger, HttpMethod.Delete, $"/holds/{hold.HoldId}"))).StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1234567890123456")]
    [InlineData("123456789012345678")]
    [InlineData("1234567890123456a")]
    [InlineData("12345678901234 56")]
    [InlineData("١٢٣٤٥٦٧٨٩٠١٢٣٤٥٦٧")] // non-ASCII digits
    public async Task Bad_student_id_returns_400_everywhere(string? student)
    {
        var classId = await CreateClassAsync(_client, 5);
        var hold = await (await Hold(_client, classId, NewStudent())).Content.ReadFromJsonAsync<HoldDto>();
        Assert.Equal(HttpStatusCode.BadRequest, (await Hold(_client, classId, student)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.SendAsync(As(student, HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.SendAsync(As(student, HttpMethod.Delete, $"/holds/{hold.HoldId}"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.SendAsync(As(student, HttpMethod.Get, "/me/holds"))).StatusCode);
    }

    [Fact]
    public async Task Unknown_ids_return_404()
    {
        var s = NewStudent();
        Assert.Equal(HttpStatusCode.NotFound, (await Hold(_client, "c_nope", s)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/holds/h_nope")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(As(s, HttpMethod.Post, "/holds/h_nope/confirm"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(As(s, HttpMethod.Delete, "/holds/h_nope"))).StatusCode);
    }

    [Fact]
    public async Task My_holds_lists_newest_first_with_class_name()
    {
        var student = NewStudent();
        await Hold(_client, await CreateClassAsync(_client, 5, "Class 6 - Morning Shift"), student);
        await Hold(_client, await CreateClassAsync(_client, 5, "Class 6 - Day Shift"), student);

        var mine = await (await _client.SendAsync(As(student, HttpMethod.Get, "/me/holds"))).Content.ReadFromJsonAsync<List<MyHoldDto>>();
        Assert.Equal(["Class 6 - Day Shift", "Class 6 - Morning Shift"], mine!.Select(h => h.ClassName));
        Assert.Empty((await (await _client.SendAsync(As(NewStudent(), HttpMethod.Get, "/me/holds"))).Content.ReadFromJsonAsync<List<MyHoldDto>>())!);
    }

    [Fact]
    public async Task Expired_hold_frees_the_seat_at_once_and_cannot_be_confirmed()
    {
        await using var shortHolds = db.Factory.WithWebHostBuilder(b => b.UseSetting("HOLD_DURATION_SECONDS", "1"));
        var c = shortHolds.CreateClient();
        var classId = await CreateClassAsync(c, 1);
        var a = NewStudent();
        var hold = await (await Hold(c, classId, a)).Content.ReadFromJsonAsync<HoldDto>();
        Assert.Equal(1, (await c.GetFromJsonAsync<ClassDto>($"/classes/{classId}"))!.HeldSeats);

        await Task.Delay(1300);
        Assert.Equal(1, (await c.GetFromJsonAsync<ClassDto>($"/classes/{classId}"))!.AvailableSeats);
        Assert.Equal("EXPIRED", (await c.GetFromJsonAsync<HoldDto>($"/holds/{hold!.HoldId}"))!.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await c.SendAsync(As(a, HttpMethod.Post, $"/holds/{hold.HoldId}/confirm"))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Hold(c, classId, NewStudent())).StatusCode); // seat reopened
    }

    [Fact]
    public async Task Sweeper_marks_expired_holds_without_any_request()
    {
        await using var shortHolds = db.Factory.WithWebHostBuilder(b => b.UseSetting("HOLD_DURATION_SECONDS", "1"));
        var c = shortHolds.CreateClient();
        var hold = await (await Hold(c, await CreateClassAsync(c, 1), NewStudent())).Content.ReadFromJsonAsync<HoldDto>();

        await Task.Delay(2600); // 1 s hold + up to 1 s until the next sweep, plus slack
        await using var conn = new NpgsqlConnection(db.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT status FROM holds WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", hold!.HoldId);
        Assert.Equal("EXPIRED", await cmd.ExecuteScalarAsync());
    }
}
