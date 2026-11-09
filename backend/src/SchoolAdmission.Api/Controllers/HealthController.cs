using Microsoft.AspNetCore.Mvc;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "Healthy" });
}
