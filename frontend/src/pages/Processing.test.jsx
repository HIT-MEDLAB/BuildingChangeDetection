import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
  } from "@testing-library/react";
  import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from "vitest";
  
  import Processing from "./Processing";
  import api from "../api";
  
  // Mock navigation so tests do not change the browser route.
  const mockNavigate = vi.fn();
  
  // Store route values that can be changed between tests.
  let mockInspectionId = "15";
  let mockLocationState = {
    beforePreview: "before-preview-url",
    afterPreview: "after-preview-url",
  };
  
  vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
  
    return {
      ...actual,
      useNavigate: () => mockNavigate,
      useParams: () => ({
        id: mockInspectionId,
      }),
      useLocation: () => ({
        state: mockLocationState,
      }),
    };
  });
  
  // Mock the API client so tests do not contact the real backend.
  vi.mock("../api", () => ({
    default: {
      get: vi.fn(),
    },
  }));
  
  describe("Processing page", () => {
    beforeEach(() => {
      // Clear all previous mock calls before every test.
      vi.clearAllMocks();
  
      // Restore the default inspection ID and navigation state.
      mockInspectionId = "15";
  
      mockLocationState = {
        beforePreview: "before-preview-url",
        afterPreview: "after-preview-url",
      };
    });
  
    afterEach(() => {
      // Restore real timers after tests that use fake timers.
      vi.useRealTimers();
    });
  
    it("renders the initial processing state", async () => {
      // Keep the request pending so the initial page remains visible.
      api.get.mockReturnValue(new Promise(() => {}));
  
      render(<Processing />);
  
      expect(
        screen.getByRole("heading", {
          name: "Processing Images",
        })
      ).toBeInTheDocument();
  
      expect(
        screen.getByText(
          "Please wait while we analyze the changes."
        )
      ).toBeInTheDocument();
  
      expect(screen.getByText("20%")).toBeInTheDocument();
  
      expect(
        screen.getByText("Uploading images...")
      ).toBeInTheDocument();
  
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          "/api/inspections/15"
        );
      });
    });
  
    it("shows an error when the inspection ID is missing", async () => {
      mockInspectionId = undefined;
  
      render(<Processing />);
  
      expect(
        await screen.findByRole("heading", {
          name: "Processing Failed",
        })
      ).toBeInTheDocument();
  
      expect(
        screen.getByText(
          "The inspection ID is missing. Please upload the images again."
        )
      ).toBeInTheDocument();
  
      expect(api.get).not.toHaveBeenCalled();
    });
  
    it("navigates to the results page when processing is completed", async () => {
      api.get.mockResolvedValue({
        data: {
          status: "completed",
        },
      });
  
      render(<Processing />);
  
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/results/15",
          {
            state: {
              beforePreview: "before-preview-url",
              afterPreview: "after-preview-url",
            },
          }
        );
      });
  
      expect(api.get).toHaveBeenCalledWith(
        "/api/inspections/15"
      );
    });
  
    it("shows a clear message when processing fails", async () => {
      api.get.mockResolvedValue({
        data: {
          status: "failed",
        },
      });
  
      render(<Processing />);
  
      expect(
        await screen.findByRole("heading", {
          name: "Processing Failed",
        })
      ).toBeInTheDocument();
  
      expect(
        screen.getByText(
          "The inspection could not be completed. Please upload the images again."
        )
      ).toBeInTheDocument();
  
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  
    it("continues polling while the inspection is still processing", async () => {
      // Use fake timers so the test does not wait two real seconds.
      vi.useFakeTimers();
  
      // The first request reports that processing is still active.
      // The second request reports that processing is complete.
      api.get
        .mockResolvedValueOnce({
          data: {
            status: "processing",
          },
        })
        .mockResolvedValueOnce({
          data: {
            status: "completed",
          },
        });
  
      render(<Processing />);
  
      // Allow the first API promise and React state updates to complete.
      await act(async () => {
        await Promise.resolve();
      });
  
      expect(api.get).toHaveBeenCalledTimes(1);
  
      expect(
        screen.getByText(
          "Detecting suspected changes..."
        )
      ).toBeInTheDocument();
  
      expect(screen.getByText("40%")).toBeInTheDocument();
  
      // Run the two-second polling timer and wait for its async work.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
  
      // The polling function should request the status a second time.
      expect(api.get).toHaveBeenCalledTimes(2);
  
      // Completed processing should navigate to the Results page.
      expect(mockNavigate).toHaveBeenCalledWith(
        "/results/15",
        {
          state: {
            beforePreview: "before-preview-url",
            afterPreview: "after-preview-url",
          },
        }
      );
    });
  
    it("shows a friendly message when the inspection is not found", async () => {
      api.get.mockRejectedValue({
        response: {
          status: 404,
        },
      });
  
      render(<Processing />);
  
      expect(
        await screen.findByText(
          "The inspection could not be found. Please upload the images again."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("heading", {
          name: "Processing Failed",
        })
      ).toBeInTheDocument();
    });
  
    it("shows a permission message for a forbidden response", async () => {
      api.get.mockRejectedValue({
        response: {
          status: 403,
        },
      });
  
      render(<Processing />);
  
      expect(
        await screen.findByText(
          "You do not have permission to view this inspection."
        )
      ).toBeInTheDocument();
  
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  
    it("shows a general message when checking the status fails", async () => {
      api.get.mockRejectedValue(
        new Error("Network error")
      );
  
      render(<Processing />);
  
      expect(
        await screen.findByText(
          "We could not check the inspection status. Please try again."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("heading", {
          name: "Processing Failed",
        })
      ).toBeInTheDocument();
    });
  
    it("returns to the Upload page when the error button is clicked", async () => {
      api.get.mockResolvedValue({
        data: {
          status: "failed",
        },
      });
  
      render(<Processing />);
  
      const backButton = await screen.findByRole(
        "button",
        {
          name: "Back to Upload",
        }
      );
  
      fireEvent.click(backButton);
  
      expect(mockNavigate).toHaveBeenCalledWith(
        "/upload"
      );
    });
  
    it("does not pass missing previews when the page was opened directly", async () => {
      mockLocationState = null;
  
      api.get.mockResolvedValue({
        data: {
          status: "completed",
        },
      });
  
      render(<Processing />);
  
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/results/15",
          {
            state: {},
          }
        );
      });
    });
  });