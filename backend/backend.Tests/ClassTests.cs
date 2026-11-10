using System.Net;
using System.Net.Http.Json;
using System.Text;
using Npgsql;
using SchoolAdmission.Api;

namespace backend.Tests;

[Collection("db")]
public class ClassTests(DatabaseFixture db)
{
    private readonly HttpClient _client = db.Factory.CreateClient();

    private record ClassDto(string Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);

    [Fact]
    public async Task Created_class_shows_full_availability()
    {
        var res = await _client.PostAsJsonAsync("/classes", new { name = "  Class 6 - Morning Shift  ", totalSeats = 120 });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var created = await res.Content.ReadFromJsonAsync<ClassDto>();
        Assert.StartsWith("c_", created!.Id);
        Assert.Equal("Class 6 - Morning Shift", created.Name); // trimmed
        Assert.Equal(120, created.TotalSeats);

        var one = await _client.GetFromJsonAsync<ClassDto>($"/classes/{created.Id}");
        Assert.Equal(new ClassDto(created.Id, "Class 6 - Morning Shift", 120, 0, 0, 120), one);

        var all = await _client.GetFromJsonAsync<List<ClassDto>>("/classes");
        Assert.Contains(all!, c => c.Id == created.Id && c.AvailableSeats == 120);
    }

    [Theory]
    [InlineData("""{"name":"","totalSeats":5}""")]
    [InlineData("""{"name":"   ","totalSeats":5}""")]
    [InlineData("""{"totalSeats":5}""")]
    [InlineData("""{"name":"A","totalSeats":0}""")]
    [InlineData("""{"name":"A","totalSeats":-5}""")]
    [InlineData("""{"name":"A"}""")]
    [InlineData("""{"name":"A","totalSeats":"abc"}""")]
    [InlineData("""{"name":"A","totalSeats":99999999999}""")]
    [InlineData("""{"name":""")]
    [InlineData("")]
    public async Task Invalid_class_input_returns_400(string body)
    {
        var res = await _client.PostAsync("/classes", new StringContent(body, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Duplicate_class_name_returns_409_ignoring_case_and_spaces()
    {
        var name = $"Class 7 - Day Shift {Guid.NewGuid():N}";
        Assert.Equal(HttpStatusCode.Created, (await _client.PostAsJsonAsync("/classes", new { name, totalSeats = 5 })).StatusCode);

        foreach (var again in new[] { name, name.ToUpperInvariant(), $"  {name}  " })
        {
            var res = await _client.PostAsJsonAsync("/classes", new { name = again, totalSeats = 9 });
            Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
            Assert.Contains("already exists", await res.Content.ReadAsStringAsync());
        }
    }

    [Fact]
    public async Task Parallel_creates_with_one_name_make_one_class()
    {
        var name = $"Race {Guid.NewGuid():N}";
        var results = await Task.WhenAll(Enumerable.Range(0, 10)
            .Select(_ => _client.PostAsJsonAsync("/classes", new { name, totalSeats = 5 })));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(9, results.Count(r => r.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task Name_longer_than_200_characters_returns_400()
    {
        var res = await _client.PostAsJsonAsync("/classes", new { name = new string('a', 201), totalSeats = 5 });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Theory]
    [InlineData("c_doesnotexist")]
    [InlineData("not-a-real-id-of-any-format-at-all-and-longer-than-sixty-four-characters-xxxxxxxx")]
    public async Task Unknown_class_returns_404(string id)
    {
        var res = await _client.GetAsync($"/classes/{id}");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Schema_setup_is_safe_when_many_processes_start_at_once()
    {
        var conn = await db.CreateDatabaseAsync();
        await using var source = NpgsqlDataSource.Create(conn);
        // Simulates several API processes starting together against an empty database.
        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Schema.EnsureAsync(source)));

        await using var cmd = source.CreateCommand(
            "SELECT count(*) FROM pg_indexes WHERE tablename = 'holds' AND indexname LIKE 'idx_holds_%'");
        Assert.Equal(3L, await cmd.ExecuteScalarAsync());
    }
}
