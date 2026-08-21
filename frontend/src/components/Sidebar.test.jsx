import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { vi } from "vitest";
import Sidebar from "./Sidebar";

// Helper function to render the Sidebar component
// with all required providers.
function renderSidebar() {
  const logoutMock = vi.fn();

  render(
    <MemoryRouter initialEntries={["/upload"]}>
      <AuthContext.Provider
        value={{
          user: {
            username: "yair",
            role: "inspector",
          },
          logout: logoutMock,
        }}
      >
        <Sidebar />
      </AuthContext.Provider>
    </MemoryRouter>
  );

  return { logoutMock };
}

describe("Sidebar component", () => {
  // Verify that clicking Logout calls the logout function.
  test("logs the user out when Logout is clicked", async () => {
    const user = userEvent.setup();
    const { logoutMock } = renderSidebar();

    await user.click(
      screen.getByRole("button", { name: /logout/i })
    );

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});