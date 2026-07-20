import { useContext, useEffect, useState } from "react";
import {
  FaUserPlus,
  FaUserCheck,
  FaUserSlash,
} from "react-icons/fa";

import { AuthContext } from "../context/AuthContext";
import api from "../api";
import "./Admin.css";

function Admin() {
  const { user: loggedInUser } = useContext(AuthContext);

  // Store the list of users returned by the server.
  const [users, setUsers] = useState([]);

  // Store the form data for creating a new user.
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "inspector",
  });

  // Manage loading and error states while fetching users.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Manage the user creation process.
  const [creatingUser, setCreatingUser] =
    useState(false);

  const [createSuccess, setCreateSuccess] =
    useState("");

  const [createError, setCreateError] =
    useState("");

  // Store the ID of the user currently being updated.
  const [updatingUserId, setUpdatingUserId] =
    useState(null);

  // Fetch all users from the server.
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/api/admin/users"
      );

      setUsers(response.data.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);

      if (err.response?.status === 403) {
        setError(
          "You do not have permission to view this page."
        );
      } else {
        setError(
          "Failed to load users. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Update the new user form fields.
  const handleNewUserChange = (event) => {
    const { name, value } = event.target;

    setNewUser((currentUser) => ({
      ...currentUser,
      [name]: value,
    }));

    setCreateSuccess("");
    setCreateError("");
  };
    // Create a new user.
    const handleCreateUser = async (event) => {
        event.preventDefault();
    
        if (
          !newUser.name.trim() ||
          !newUser.email.trim() ||
          !newUser.password
        ) {
          setCreateError(
            "Name, email and password are required."
          );
          return;
        }
    
        try {
          setCreatingUser(true);
          setCreateSuccess("");
          setCreateError("");
    
          const response = await api.post(
            "/api/admin/users",
            {
              name: newUser.name.trim(),
              email: newUser.email.trim(),
              password: newUser.password,
              role: newUser.role,
            }
          );
    
          // Add the newly created user to the top of the list.
          setUsers((currentUsers) => [
            response.data,
            ...currentUsers,
          ]);
    
          // Reset the form after successful creation.
          setNewUser({
            name: "",
            email: "",
            password: "",
            role: "inspector",
          });
    
          setCreateSuccess(
            "User created successfully."
          );
        } catch (err) {
          console.error("Failed to create user:", err);
    
          if (err.response?.status === 409) {
            setCreateError(
              "A user with this email already exists."
            );
          } else if (err.response?.status === 403) {
            setCreateError(
              "You do not have permission to create users."
            );
          } else {
            setCreateError(
              err.response?.data?.error ||
                "Failed to create user."
            );
          }
        } finally {
          setCreatingUser(false);
        }
      };
    
      // Update the selected user's role.
      const handleRoleChange = async (
        targetUser,
        newRole
      ) => {
        try {
          setUpdatingUserId(targetUser.id);
          setError("");
    
          const response = await api.patch(
            `/api/admin/users/${targetUser.id}`,
            {
              role: newRole,
            }
          );
    
          setUsers((currentUsers) =>
            currentUsers.map((currentUser) =>
              currentUser.id === targetUser.id
                ? response.data
                : currentUser
            )
          );
        } catch (err) {
          console.error(
            "Failed to update user role:",
            err
          );
    
          setError(
            err.response?.data?.error ||
              "Failed to update user role."
          );
        } finally {
          setUpdatingUserId(null);
        }
      };
    
      // Enable or disable a user account.
      const handleToggleUserStatus = async (
        targetUser
      ) => {
        try {
          setUpdatingUserId(targetUser.id);
          setError("");
    
          const response = await api.patch(
            `/api/admin/users/${targetUser.id}`,
            {
              isActive: !targetUser.isActive,
            }
          );
    
          setUsers((currentUsers) =>
            currentUsers.map((currentUser) =>
              currentUser.id === targetUser.id
                ? response.data
                : currentUser
            )
          );
        } catch (err) {
          console.error(
            "Failed to update user status:",
            err
          );
    
          setError(
            err.response?.data?.error ||
              "Failed to update user status."
          );
        } finally {
          setUpdatingUserId(null);
        }
      };
      if (loading) {
        return (
          <div className="admin-page">
            <h1>User Management</h1>
    
            <p className="admin-message">
              Loading users...
            </p>
          </div>
        );
      }
    
      return (
        <div className="admin-page">
          <h1>User Management</h1>
    
          <p className="admin-subtitle">
            Create users and manage their access to the system.
          </p>
    
          {/* User creation form */}
          <section className="admin-create-card">
            <div className="admin-section-title">
              <FaUserPlus />
    
              <div>
                <h2>Create New User</h2>
    
                <p>
                  Create an inspector or administrator account.
                </p>
              </div>
            </div>
    
            <form
              className="admin-create-form"
              onSubmit={handleCreateUser}
            >
              <div className="admin-form-field">
                <label htmlFor="admin-user-name">
                  Full Name
                </label>
    
                <input
                  id="admin-user-name"
                  name="name"
                  type="text"
                  value={newUser.name}
                  onChange={handleNewUserChange}
                  placeholder="Enter full name"
                  disabled={creatingUser}
                />
              </div>
    
              <div className="admin-form-field">
                <label htmlFor="admin-user-email">
                  Email
                </label>
    
                <input
                  id="admin-user-email"
                  name="email"
                  type="email"
                  value={newUser.email}
                  onChange={handleNewUserChange}
                  placeholder="Enter email address"
                  disabled={creatingUser}
                />
              </div>
    
              <div className="admin-form-field">
                <label htmlFor="admin-user-password">
                  Password
                </label>
    
                <input
                  id="admin-user-password"
                  name="password"
                  type="password"
                  value={newUser.password}
                  onChange={handleNewUserChange}
                  placeholder="Enter password"
                  disabled={creatingUser}
                />
              </div>
    
              <div className="admin-form-field">
                <label htmlFor="admin-user-role">
                  Role
                </label>
    
                <select
                  id="admin-user-role"
                  name="role"
                  value={newUser.role}
                  onChange={handleNewUserChange}
                  disabled={creatingUser}
                >
                  <option value="inspector">
                    Inspector
                  </option>
    
                  <option value="admin">
                    Admin
                  </option>
                </select>
              </div>
    
              <button
                type="submit"
                className="admin-create-button"
                disabled={creatingUser}
              >
                <FaUserPlus />
    
                {creatingUser
                  ? "Creating..."
                  : "Create User"}
              </button>
            </form>
    
            {createSuccess && (
              <p
                className="admin-success-message"
                role="status"
              >
                {createSuccess}
              </p>
            )}
    
            {createError && (
              <p
                className="admin-error-message"
                role="alert"
              >
                {createError}
              </p>
            )}
          </section>
    
          {/* Display a general error message */}
          {error && (
            <p
              className="admin-error-message admin-general-error"
              role="alert"
            >
              {error}
            </p>
          )}
    
          {/* Users table */}
          <section className="admin-users-card">
            <h2>System Users</h2>
    
            {users.length === 0 ? (
              <p className="admin-message">
                No users were found.
              </p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Account Status</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
    
                  <tbody>
                    {users.map((systemUser) => {
                      const isCurrentUser =
                        Number(systemUser.id) ===
                        Number(loggedInUser?.id);
    
                      const isUpdating =
                        updatingUserId === systemUser.id;
    
                      return (
                        <tr key={systemUser.id}>
                          <td>
                            <div className="admin-user-name">
                              <span>
                                {systemUser.name}
                              </span>
    
                              {isCurrentUser && (
                                <small>
                                  Current account
                                </small>
                              )}
                            </div>
                          </td>
    
                          <td>{systemUser.email}</td>
    
                          <td>
                            <select
                              className="admin-role-select"
                              value={systemUser.role}
                              onChange={(event) =>
                                handleRoleChange(
                                  systemUser,
                                  event.target.value
                                )
                              }
                              disabled={
                                isUpdating ||
                                isCurrentUser
                              }
                            >
                              <option value="inspector">
                                Inspector
                              </option>
    
                              <option value="admin">
                                Admin
                              </option>
                            </select>
                          </td>
    
                          <td>
                            <span
                              className={
                                systemUser.isActive
                                  ? "admin-status-active"
                                  : "admin-status-disabled"
                              }
                            >
                              {systemUser.isActive
                                ? "Active"
                                : "Disabled"}
                            </span>
                          </td>
    
                          <td>
                            {systemUser.createdAt
                              ? new Date(
                                  systemUser.createdAt
                                ).toLocaleString()
                              : "No date"}
                          </td>
    
                          <td>
                            <button
                              type="button"
                              className={
                                systemUser.isActive
                                  ? "admin-disable-button"
                                  : "admin-enable-button"
                              }
                              onClick={() =>
                                handleToggleUserStatus(
                                  systemUser
                                )
                              }
                              disabled={
                                isUpdating ||
                                isCurrentUser
                              }
                            >
                              {systemUser.isActive ? (
                                <FaUserSlash />
                              ) : (
                                <FaUserCheck />
                              )}
    
                              {isUpdating
                                ? "Updating..."
                                : systemUser.isActive
                                  ? "Disable"
                                  : "Enable"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      );
    }
    
    export default Admin;