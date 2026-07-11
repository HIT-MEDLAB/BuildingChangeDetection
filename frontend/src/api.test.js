import { beforeEach, describe, expect, test, vi } from "vitest";

// Create the interceptor mocks before vi.mock is evaluated
const mocks = vi.hoisted(() => {
  return {
    requestUseMock: vi.fn(),
    responseUseMock: vi.fn(),
    axiosCreateMock: vi.fn(),
  };
});

// Mock Axios before api.js is imported
vi.mock("axios", () => {
  const apiInstanceMock = {
    interceptors: {
      request: {
        use: mocks.requestUseMock,
      },
      response: {
        use: mocks.responseUseMock,
      },
    },
  };

  mocks.axiosCreateMock.mockReturnValue(apiInstanceMock);

  return {
    default: {
      create: mocks.axiosCreateMock,
    },
  };
});

// Import api.js again so its interceptor setup runs for every test
async function loadApiModule() {
  vi.resetModules();
  await import("./api");
}

describe("API configuration", () => {
  beforeEach(() => {
    // Reset calls and browser storage before every test
    vi.clearAllMocks();
    localStorage.clear();
  });

  // Verify that Axios is configured with the expected backend URL
  test("creates the Axios instance with the expected base URL", async () => {
    await loadApiModule();

    expect(mocks.axiosCreateMock).toHaveBeenCalledWith({
      baseURL: "http://localhost:3000",
    });
  });

  // Verify that authenticated requests include the stored JWT token
  test("adds the JWT token to outgoing requests", async () => {
    localStorage.setItem("token", "test-token");

    await loadApiModule();

    const requestInterceptor =
      mocks.requestUseMock.mock.calls[0][0];

    const config = {
      headers: {},
    };

    const updatedConfig = requestInterceptor(config);

    expect(updatedConfig.headers.Authorization).toBe(
      "Bearer test-token"
    );
  });

  // Verify that unauthenticated requests do not include Authorization
  test("does not add an Authorization header when no token exists", async () => {
    await loadApiModule();

    const requestInterceptor =
      mocks.requestUseMock.mock.calls[0][0];

    const config = {
      headers: {},
    };

    const updatedConfig = requestInterceptor(config);

    expect(updatedConfig.headers.Authorization).toBeUndefined();
  });

  // Verify that an expired token is removed after a 401 response
  test("removes the token when the backend returns 401", async () => {
    localStorage.setItem("token", "expired-token");

    await loadApiModule();

    const rejectedInterceptor =
      mocks.responseUseMock.mock.calls[0][1];

    const error = {
      response: {
        status: 401,
      },
    };

    try {
      await rejectedInterceptor(error);
    } catch {
      // The interceptor is expected to reject the original error
    }

    expect(localStorage.getItem("token")).toBeNull();
  });

  // Verify that the original backend error is returned to the caller
  test("rejects the original response error", async () => {
    await loadApiModule();

    const rejectedInterceptor =
      mocks.responseUseMock.mock.calls[0][1];

    const error = {
      response: {
        status: 500,
      },
    };

    await expect(rejectedInterceptor(error)).rejects.toBe(error);
  });
});