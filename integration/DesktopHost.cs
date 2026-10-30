using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

namespace SupplyPlanner.Web.Services;

// Installed only into a private build copy by prepare-planner.py.
public static class DesktopHost
{
    public static void UseDesktopHost(this WebApplication app)
    {
        var secret = Environment.GetEnvironmentVariable("SELLERSTATUS_DESKTOP_SESSION");
        var owner = Environment.GetEnvironmentVariable("SELLERSTATUS_DESKTOP_OWNER");
        if (secret is null || secret.Length != 64 || !Guid.TryParseExact(owner, "N", out _)
            || !app.Environment.IsDevelopment())
            throw new InvalidOperationException("Desktop host configuration is missing.");
        var expected = Encoding.UTF8.GetBytes(secret);
        bool Matches(string? candidate) => candidate is not null && candidate.Length == secret.Length
            && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(candidate), expected);
        app.Use(async (context, next) =>
        {
            var origin = context.Request.Headers.Origin.ToString();
            var local = context.Connection.RemoteIpAddress is { } ip && IPAddress.IsLoopback(ip)
                && context.Request.Host.Host == "127.0.0.1"
                && (origin.Length == 0 || origin == $"http://{context.Request.Host}");
            var header = Matches(context.Request.Headers["X-SellerStatus-Desktop"].ToString());
            var cookie = Matches(context.Request.Cookies["sellerstatus.desktop"]);
            if (!local || (!header && !cookie))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
            if (header)
                context.Response.Cookies.Append("sellerstatus.desktop", secret, new CookieOptions
                { HttpOnly = true, SameSite = SameSiteMode.Strict, Path = "/", IsEssential = true });
            context.Items["SellerStatus.DesktopOwner"] = owner;
            await next();
        });
        app.Lifetime.ApplicationStarted.Register(() =>
        {
            var addresses = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>();
            var address = addresses?.Addresses.Single(value => value.StartsWith("http://127.0.0.1:", StringComparison.Ordinal));
            Console.WriteLine("SELLERSTATUS_PLANNER_READY " + address);
            Console.Out.Flush();
            // This owned pipe closes on both normal exit and a parent crash.
            // Start watching after application startup to avoid cancelling bootstrap.
            _ = Task.Run(async () =>
            {
                using var input = Console.OpenStandardInput();
                var buffer = new byte[64];
                while (await input.ReadAsync(buffer.AsMemory()) != 0) { }
                app.Lifetime.StopApplication();
            });
        });
    }
}
