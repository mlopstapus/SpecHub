import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSessionUser } from "@/bcs/identity-access";
import { AppShell } from "./app-shell";

const user: AppSessionUser = {
  id: "user-123",
  orgId: "org-123",
  teamId: "team-123",
  role: "admin",
  email: "jane@example.com",
  displayName: "Jane Doe",
  teamName: "Platform",
};

describe("AppShell", () => {
  it("composes navigation, account identity, and protected child content", () => {
    const markup = renderToStaticMarkup(
      <AppShell navigation={<nav>Workspace navigation</nav>} user={user}>
        <main>Protected child content</main>
      </AppShell>,
    );

    expect(markup).toContain("Workspace navigation");
    expect(markup).toContain("Jane Doe");
    expect(markup).toContain("Admin · Platform");
    expect(markup).toContain("Protected child content");
  });
});
