import { createContext, useState } from "react";

export const AuthContext = createContext();

function AuthProvider({ children }) {
  // Load the user saved in the browser after a previous login.
  const storedUser = localStorage.getItem("user");

  // Store the currently authenticated user.
  const [user, setUser] = useState(() => {
    try {
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  // Consider the user logged in when a token exists.
  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(localStorage.getItem("token"))
  );

  // Save the token and authenticated user returned by the server.
  const login = (token, loggedInUser) => {
    localStorage.setItem("token", token);
    localStorage.setItem(
      "user",
      JSON.stringify(loggedInUser)
    );
    localStorage.setItem("isLoggedIn", "true");

    setUser(loggedInUser);
    setIsLoggedIn(true);
  };

  // Remove all authentication data.
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");

    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;