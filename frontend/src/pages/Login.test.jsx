import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { vi } from "vitest";
import Login from "./Login";

// Mock the API module to prevent real HTTP requests during testing
vi.mock("../api", () => ({
  default: {
    post: vi.fn(),
  },
}));

// Helper function to render the Login component
// with all required providers
function renderLogin() {
  const loginMock = vi.fn();

  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ login: loginMock }}>
        <Login />
      </AuthContext.Provider>
    </MemoryRouter>
  );

  return { loginMock };
}

describe("Login component", () => {

  // Verify that validation is displayed when
  // the user submits an empty form
  test("shows validation error when fields are empty", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(
      screen.getByRole("button", { name: /login/i })
    );

    expect(
      screen.getByText("Please fill in all fields.")
    ).toBeInTheDocument();
  });

  // Verify that the user can type into both input fields
  test("allows the user to type email and password", async () => {
    const user = userEvent.setup();

    renderLogin();

    const emailInput = screen.getByPlaceholderText("Enter your email");
    const passwordInput = screen.getByPlaceholderText("Enter your password");

    await user.type(emailInput, "yair@medlab.hit.ac.il");
    await user.type(passwordInput, "password123");

    expect(emailInput).toHaveValue("yair@medlab.hit.ac.il");
    expect(passwordInput).toHaveValue("password123");
  });
});