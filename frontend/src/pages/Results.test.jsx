import {
    act,
    render,
    screen,
    waitFor,
  } from "@testing-library/react";
  import userEvent from "@testing-library/user-event";
  import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
  } from "vitest";
  
  import api from "../api";
  import Results from "./Results";
  
  // Hoisted mocks are available when Vitest creates module mocks.
  const routerMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
  }));
  
  // Mock the React Router hooks used by Results.
  // This lets us test the component without rendering Route and Routes.
  vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual(
      "react-router-dom"
    );
  
    return {
      ...actual,
  
      useParams: () => ({
        id: "123",
      }),
  
      useLocation: () => ({
        state: {
          beforePreview: "before-image.jpg",
          afterPreview: "after-image.jpg",
        },
      }),
  
      useNavigate: () => routerMocks.navigate,
    };
  });
  
  // Mock API methods so tests do not contact the real backend.
  vi.mock("../api", () => ({
    default: {
      get: vi.fn(),
      patch: vi.fn(),
    },
  }));
  
  // A completed inspection used in multiple tests.
  const completedInspection = {
    id: "123",
    status: "completed",
    caseStatus: "under_review",
  
    results: {
      changesDetected: true,
  
      boundingBoxes: [
        {
          x: 120,
          y: 85,
          w: 200,
          h: 150,
        },
        {
          x: 400,
          y: 300,
          w: 80,
          h: 60,
        },
      ],
    },
  };
  
  // Render the Results page directly.
  function renderResults() {
    return render(<Results />);
  }
  
  describe("Results component", () => {
    let consoleErrorMock;
    let linkClickMock;
    let createObjectURLMock;
    let revokeObjectURLMock;
  
    beforeEach(() => {
      // Clear calls and mock implementations from previous tests.
      vi.clearAllMocks();
  
      // Hide expected console errors during failure tests.
      consoleErrorMock = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
  
      // Mock browser APIs used when downloading the PDF.
      createObjectURLMock = vi.fn(
        () => "blob:test-report"
      );
  
      revokeObjectURLMock = vi.fn();
  
      Object.defineProperty(
        window.URL,
        "createObjectURL",
        {
          value: createObjectURLMock,
          configurable: true,
        }
      );
  
      Object.defineProperty(
        window.URL,
        "revokeObjectURL",
        {
          value: revokeObjectURLMock,
          configurable: true,
        }
      );
  
      // Prevent jsdom from attempting real navigation.
      linkClickMock = vi
        .spyOn(
          HTMLAnchorElement.prototype,
          "click"
        )
        .mockImplementation(() => {});
    });
  
    afterEach(() => {
      // Restore original browser functions after each test.
      consoleErrorMock.mockRestore();
      linkClickMock.mockRestore();
    });
  
    test("shows loading state while results are being fetched", () => {
      // Keep the request pending.
      api.get.mockImplementation(
        () => new Promise(() => {})
      );
  
      renderResults();
  
      expect(
        screen.getByText("Loading results...")
      ).toBeInTheDocument();
    });
  
    test("shows an error when loading the inspection fails", async () => {
      api.get.mockRejectedValue(
        new Error("Network error")
      );
  
      renderResults();
  
      expect(
        await screen.findByText(
          "We could not load the inspection results. Please try again."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Back to Upload",
        })
      ).toBeInTheDocument();
    });
  
    test("navigates back to Upload after a loading error", async () => {
      const user = userEvent.setup();
  
      api.get.mockRejectedValue(
        new Error("Network error")
      );
  
      renderResults();
  
      await user.click(
        await screen.findByRole("button", {
          name: "Back to Upload",
        })
      );
  
      expect(
        routerMocks.navigate
      ).toHaveBeenCalledWith("/upload");
    });
  
    test("shows a processing message when inspection is not completed", async () => {
      api.get.mockResolvedValue({
        data: {
          id: "123",
          status: "processing",
          results: null,
        },
      });
  
      renderResults();
  
      expect(
        await screen.findByText(
          "The inspection is still being processed."
        )
      ).toBeInTheDocument();
    });
  
    test("shows a failure message when analysis failed", async () => {
      api.get.mockResolvedValue({
        data: {
          id: "123",
          status: "failed",
          results: null,
        },
      });
  
      renderResults();
  
      expect(
        await screen.findByText(
          /The inspection could not be completed/
        )
      ).toBeInTheDocument();
    });
  
    test("shows the number of detected changes", async () => {
      api.get.mockResolvedValue({
        data: completedInspection,
      });
  
      renderResults();
  
      expect(
        await screen.findByText(
          "Changes detected: 2"
        )
      ).toBeInTheDocument();
    });
  
    test("handles missing bounding boxes safely", async () => {
      api.get.mockResolvedValue({
        data: {
          id: "123",
          status: "completed",
          caseStatus: "under_review",
  
          results: {
            changesDetected: false,
          },
        },
      });
  
      renderResults();
  
      expect(
        await screen.findByText(
          "No changes detected"
        )
      ).toBeInTheDocument();
  
      expect(
        screen.queryByLabelText(
          "Detected change 1"
        )
      ).not.toBeInTheDocument();
    });
  
    test("renders every detected bounding box", async () => {
      api.get.mockResolvedValue({
        data: completedInspection,
      });
  
      renderResults();
  
      const afterImage =
        await screen.findByAltText(
          "After inspection"
        );
  
      // jsdom does not load real image dimensions.
      Object.defineProperty(
        afterImage,
        "naturalWidth",
        {
          value: 800,
          configurable: true,
        }
      );
  
      Object.defineProperty(
        afterImage,
        "naturalHeight",
        {
          value: 600,
          configurable: true,
        }
      );
  
      // Trigger the image load handler.
      await act(async () => {
        afterImage.dispatchEvent(
          new Event("load", {
            bubbles: true,
          })
        );
      });
  
      await waitFor(() => {
        expect(
          screen.getByLabelText(
            "Detected change 1"
          )
        ).toBeInTheDocument();
  
        expect(
          screen.getByLabelText(
            "Detected change 2"
          )
        ).toBeInTheDocument();
      });
  
      const firstBox =
        screen.getByLabelText(
          "Detected change 1"
        );
  
      expect(firstBox).toHaveStyle({
        left: "15%",
        top: "14.166666666666666%",
        width: "25%",
        height: "25%",
      });
    });
  
    test("updates the case status", async () => {
      const user = userEvent.setup();
  
      api.get.mockResolvedValue({
        data: completedInspection,
      });
  
      api.patch.mockResolvedValue({
        data: {
          caseStatus: "confirmed",
        },
      });
  
      renderResults();
  
      const statusSelect =
        await screen.findByLabelText(
          "Case Status"
        );
  
      await user.selectOptions(
        statusSelect,
        "confirmed"
      );
  
      await user.click(
        screen.getByRole("button", {
          name: "Update Status",
        })
      );
  
      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith(
          "/api/inspections/123/status",
          {
            caseStatus: "confirmed",
          }
        );
      });
  
      expect(
        await screen.findByText(
          "Case status updated successfully."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByText(/Current status:/)
      ).toBeInTheDocument();
    });
  
    test("shows an error when case status update fails", async () => {
      const user = userEvent.setup();
  
      api.get.mockResolvedValue({
        data: completedInspection,
      });
  
      api.patch.mockRejectedValue({
        response: {
          status: 403,
        },
      });
  
      renderResults();
  
      await user.selectOptions(
        await screen.findByLabelText(
          "Case Status"
        ),
        "confirmed"
      );
  
      await user.click(
        screen.getByRole("button", {
          name: "Update Status",
        })
      );
  
      expect(
        await screen.findByText(
          "You do not have permission to update this case."
        )
      ).toBeInTheDocument();
    });
  
    test("downloads the summary report", async () => {
      const user = userEvent.setup();
  
      // First GET loads the inspection.
      api.get
        .mockResolvedValueOnce({
          data: completedInspection,
        })
  
        // Second GET returns PDF data.
        .mockResolvedValueOnce({
          data: new Uint8Array([
            80,
            68,
            70,
          ]),
        });
  
      renderResults();
  
      await user.click(
        await screen.findByRole("button", {
          name: /Download Summary Report/i,
        })
      );
  
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          "/api/report/123",
          {
            responseType: "blob",
          }
        );
      });
  
      expect(
        createObjectURLMock
      ).toHaveBeenCalledTimes(1);
  
      expect(
        linkClickMock
      ).toHaveBeenCalledTimes(1);
  
      expect(
        revokeObjectURLMock
      ).toHaveBeenCalledWith(
        "blob:test-report"
      );
    });
  
    test("shows an error when the report is unavailable", async () => {
      const user = userEvent.setup();
  
      api.get
        .mockResolvedValueOnce({
          data: completedInspection,
        })
        .mockRejectedValueOnce({
          response: {
            status: 404,
          },
        });
  
      renderResults();
  
      await user.click(
        await screen.findByRole("button", {
          name: /Download Summary Report/i,
        })
      );
  
      expect(
        await screen.findByText(
          "The report is not available for this inspection."
        )
      ).toBeInTheDocument();
    });
  });