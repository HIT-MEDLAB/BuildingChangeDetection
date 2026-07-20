import {
    render,
    screen,
    waitFor,
  } from "@testing-library/react";
  import {
    MemoryRouter,
    Route,
    Routes,
  } from "react-router-dom";
  import {
    beforeEach,
    describe,
    expect,
    test,
    vi,
  } from "vitest";
  
  import api from "../api";
  import AdminRoute from "../components/AdminRoute";
  import { AuthContext } from "../context/AuthContext";
  import Admin from "./Admin";
  
  // Mock the API module so the tests do not contact the real backend.
  vi.mock("../api", () => ({
    default: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    },
  }));
  
  // Render the protected Admin route with a selected authentication state.
  function renderAdminRoute({
    isLoggedIn,
    user,
  }) {
    return render(
      <AuthContext.Provider
        value={{
          isLoggedIn,
          user,
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <MemoryRouter
          initialEntries={["/admin"]}
        >
          <Routes>
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
  
            {/* Test destination for unauthenticated users */}
            <Route
              path="/login"
              element={<h1>Login Page</h1>}
            />
  
            {/* Test destination for logged-in non-admin users */}
            <Route
              path="/upload"
              element={<h1>Upload Page</h1>}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
  }
  
  describe("Admin access by role", () => {
    beforeEach(() => {
      // Clear previous API calls and mock results.
      vi.clearAllMocks();
  
      // Hide expected console errors during error tests.
      vi.spyOn(console, "error").mockImplementation(
        () => {}
      );
    });
  
    test("allows an admin user to view the Admin screen", async () => {
      // Return an empty users list after the Admin page loads.
      api.get.mockResolvedValue({
        data: {
          users: [],
        },
      });
  
      renderAdminRoute({
        isLoggedIn: true,
        user: {
          id: 1,
          name: "Admin User",
          role: "admin",
        },
      });
  
      // The Admin page should be visible.
      expect(
        await screen.findByRole("heading", {
          name: "User Management",
        })
      ).toBeInTheDocument();
  
      // Confirm that the page requested the users list.
      expect(api.get).toHaveBeenCalledWith(
        "/api/admin/users"
      );
    });
  
    test("redirects an inspector away from the Admin screen", async () => {
      renderAdminRoute({
        isLoggedIn: true,
        user: {
          id: 2,
          name: "Inspector User",
          role: "inspector",
        },
      });
  
      // Inspectors are redirected to the Upload page.
      expect(
        await screen.findByRole("heading", {
          name: "Upload Page",
        })
      ).toBeInTheDocument();
  
      // The Admin API should not be called because access was blocked.
      expect(api.get).not.toHaveBeenCalled();
    });
  
    test("redirects an unauthenticated user to Login", async () => {
      renderAdminRoute({
        isLoggedIn: false,
        user: null,
      });
  
      // Users who are not logged in are redirected to Login.
      expect(
        await screen.findByRole("heading", {
          name: "Login Page",
        })
      ).toBeInTheDocument();
  
      // The protected Admin component should not send an API request.
      expect(api.get).not.toHaveBeenCalled();
    });
  
    test("shows a permission error when the server returns 403", async () => {
      // Simulate a backend permission rejection.
      api.get.mockRejectedValue({
        response: {
          status: 403,
        },
      });
  
      renderAdminRoute({
        isLoggedIn: true,
        user: {
          id: 1,
          name: "Admin User",
          role: "admin",
        },
      });
  
      expect(
        await screen.findByText(
          "You do not have permission to view this page."
        )
      ).toBeInTheDocument();
    });
  
    test("shows an empty message when no users exist", async () => {
      api.get.mockResolvedValue({
        data: {
          users: [],
        },
      });
  
      renderAdminRoute({
        isLoggedIn: true,
        user: {
          id: 1,
          name: "Admin User",
          role: "admin",
        },
      });
  
      expect(
        await screen.findByText(
          "No users were found."
        )
      ).toBeInTheDocument();
    });
  
    test("shows the users returned by the backend", async () => {
      api.get.mockResolvedValue({
        data: {
          users: [
            {
              id: 1,
              name: "Admin User",
              email: "admin@example.com",
              role: "admin",
              isActive: true,
              createdAt:
                "2026-07-20T10:00:00.000Z",
            },
            {
              id: 2,
              name: "Inspector User",
              email: "inspector@example.com",
              role: "inspector",
              isActive: true,
              createdAt:
                "2026-07-20T11:00:00.000Z",
            },
          ],
        },
      });
  
      renderAdminRoute({
        isLoggedIn: true,
        user: {
          id: 1,
          name: "Admin User",
          role: "admin",
        },
      });
  
      // Wait for both users to appear in the table.
      expect(
        await screen.findByText(
          "admin@example.com"
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByText(
          "inspector@example.com"
        )
      ).toBeInTheDocument();
  
      // Verify the users table is displayed.
      expect(
        screen.getByRole("table")
      ).toBeInTheDocument();
  
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(1);
      });
    });
  });