import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
  } from "@testing-library/react";
  import { MemoryRouter } from "react-router-dom";
  import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from "vitest";
  
  import History from "./History";
  import api from "../api";
  
  // Mock the API client so tests do not contact the real backend.
  vi.mock("../api", () => ({
    default: {
      get: vi.fn(),
    },
  }));
  
  // Reusable inspection data for the History tests.
  const mockInspections = [
    {
      id: 1,
      created_at: "2026-07-01T10:00:00.000Z",
      image_before_path: "uploads/before-1.jpg",
      image_after_path: "uploads/after-1.jpg",
      changes_detected: false,
      status: "completed",
      case_status: "under_review",
    },
    {
      id: 2,
      created_at: "2026-07-03T10:00:00.000Z",
      image_before_path: "uploads/before-2.jpg",
      image_after_path: "uploads/after-2.jpg",
      changes_detected: true,
      status: "completed",
      case_status: "confirmed",
    },
    {
      id: 3,
      created_at: "2026-07-02T10:00:00.000Z",
      image_before_path: "uploads/before-3.jpg",
      image_after_path: "uploads/after-3.jpg",
      changes_detected: true,
      status: "completed",
      case_status: "under_review",
    },
  ];
  
  // History uses useNavigate(), so every test must render it inside a Router.
  const renderHistory = () => {
    return render(
      <MemoryRouter>
        <History />
      </MemoryRouter>
    );
  };
  
  describe("History page", () => {
    let consoleErrorSpy;
    let createObjectURLSpy;
    let revokeObjectURLSpy;
    let anchorClickSpy;
  
    beforeEach(() => {
      // Clear API calls and mocks from previous tests.
      vi.clearAllMocks();
  
      // Hide expected console errors from the test output.
      consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
  
      // Mock browser download functions that are unavailable in jsdom.
      createObjectURLSpy = vi
        .spyOn(window.URL, "createObjectURL")
        .mockReturnValue("blob:mock-report-url");
  
      revokeObjectURLSpy = vi
        .spyOn(window.URL, "revokeObjectURL")
        .mockImplementation(() => {});
  
      // Prevent jsdom from attempting a real file download.
      anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
    });
  
    afterEach(() => {
      // Restore all browser and console functions after each test.
      consoleErrorSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      anchorClickSpy.mockRestore();
    });
  
    it("shows the loading state while history is being requested", () => {
      // Keep the request pending so the loading message remains visible.
      api.get.mockReturnValue(new Promise(() => {}));
  
      renderHistory();
  
      expect(
        screen.getByRole("heading", {
          name: "Inspection History",
        })
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("Loading inspection history...")
      ).toBeInTheDocument();
  
      expect(api.get).toHaveBeenCalledWith("/api/inspections");
    });
  
    it("shows an empty state when there are no inspections", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: [],
        },
      });
  
      renderHistory();
  
      expect(
        await screen.findByRole("heading", {
          name: "No inspections yet",
        })
      ).toBeInTheDocument();
  
      expect(
        screen.getByText(
          "Your uploaded inspections will appear here."
        )
      ).toBeInTheDocument();
    });
  
    it("supports a direct inspection array from the backend", async () => {
      api.get.mockResolvedValue({
        data: [mockInspections[0]],
      });
  
      renderHistory();
  
      expect(
        await screen.findByText("No Change Detected")
      ).toBeInTheDocument();
  
      expect(
        screen.getByAltText("Before inspection")
      ).toHaveAttribute(
        "src",
        expect.stringContaining("uploads/before-1.jpg")
      );
    });
  
    it("shows a friendly error when history cannot be loaded", async () => {
      api.get.mockRejectedValue(
        new Error("Network error")
      );
  
      renderHistory();
  
      expect(
        await screen.findByRole("heading", {
          name: "Unable to load history",
        })
      ).toBeInTheDocument();
  
      expect(
        screen.getByText(
          "We could not load your inspection history. Please try again."
        )
      ).toBeInTheDocument();
  
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  
    it("renders inspection images, results, and case statuses", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: mockInspections,
        },
      });
  
      renderHistory();
  
      expect(
        await screen.findAllByText("Change Detected")
      ).toHaveLength(2);
  
      expect(
        screen.getByText("No Change Detected")
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("Confirmed")
      ).toBeInTheDocument();
  
      expect(
        screen.getAllByText("Under Review")
      ).toHaveLength(2);
  
      expect(
        screen.getAllByAltText("Before inspection")
      ).toHaveLength(3);
  
      expect(
        screen.getAllByAltText("After inspection")
      ).toHaveLength(3);
    });
  
    it("shows missing image text when image paths do not exist", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: [
            {
              id: 10,
              created_at: null,
              image_before_path: null,
              image_after_path: null,
              changes_detected: false,
              status: "completed",
            },
          ],
        },
      });
  
      renderHistory();
  
      expect(
        await screen.findByText("No date")
      ).toBeInTheDocument();
  
      expect(
        screen.getAllByText("No image")
      ).toHaveLength(2);
    });
  
    it("sorts inspections by priority by default", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: mockInspections,
        },
      });
  
      renderHistory();
  
      await screen.findAllByAltText("Before inspection");
  
      const rows = screen
        .getAllByRole("row")
        .slice(1);
  
      expect(
        within(rows[0])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-3.jpg");
  
      expect(
        within(rows[1])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-2.jpg");
  
      expect(
        within(rows[2])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-1.jpg");
  
      expect(
        screen.getByRole("button", {
          name: "Priority First",
        })
      ).toHaveClass("active-sort");
    });
  
    it("sorts inspections from newest to oldest", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: mockInspections,
        },
      });
  
      renderHistory();
  
      await screen.findAllByAltText("Before inspection");
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Newest First",
        })
      );
  
      const rows = screen
        .getAllByRole("row")
        .slice(1);
  
      expect(
        within(rows[0])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-2.jpg");
  
      expect(
        within(rows[1])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-3.jpg");
  
      expect(
        within(rows[2])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-1.jpg");
  
      expect(
        screen.getByRole("button", {
          name: "Newest First",
        })
      ).toHaveClass("active-sort");
    });
  
    it("sorts inspections from oldest to newest", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: mockInspections,
        },
      });
  
      renderHistory();
  
      await screen.findAllByAltText("Before inspection");
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Oldest First",
        })
      );
  
      const rows = screen
        .getAllByRole("row")
        .slice(1);
  
      expect(
        within(rows[0])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-1.jpg");
  
      expect(
        within(rows[1])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-3.jpg");
  
      expect(
        within(rows[2])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("before-2.jpg");
  
      expect(
        screen.getByRole("button", {
          name: "Oldest First",
        })
      ).toHaveClass("active-sort");
    });
  
    it("downloads a PDF report successfully", async () => {
      api.get
        .mockResolvedValueOnce({
          data: {
            inspections: [mockInspections[0]],
          },
        })
        .mockResolvedValueOnce({
          data: new Uint8Array([1, 2, 3]),
        });
  
      renderHistory();
  
      const downloadButton =
        await screen.findByRole("button", {
          name: "Download PDF",
        });
  
      fireEvent.click(downloadButton);
  
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          "/api/report/1",
          {
            responseType: "blob",
          }
        );
      });
  
      expect(
        window.URL.createObjectURL
      ).toHaveBeenCalled();
  
      expect(anchorClickSpy).toHaveBeenCalled();
  
      expect(
        window.URL.revokeObjectURL
      ).toHaveBeenCalledWith(
        "blob:mock-report-url"
      );
    });
  
    it("shows a friendly message when a report is unavailable", async () => {
      api.get
        .mockResolvedValueOnce({
          data: {
            inspections: [mockInspections[0]],
          },
        })
        .mockRejectedValueOnce({
          response: {
            status: 404,
          },
        });
  
      renderHistory();
  
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Download PDF",
        })
      );
  
      expect(
        await screen.findByRole("alert")
      ).toHaveTextContent(
        "The report is not available for this inspection."
      );
    });
  
    it("shows a permission message when report access is forbidden", async () => {
      api.get
        .mockResolvedValueOnce({
          data: {
            inspections: [mockInspections[0]],
          },
        })
        .mockRejectedValueOnce({
          response: {
            status: 403,
          },
        });
  
      renderHistory();
  
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Download PDF",
        })
      );
  
      expect(
        await screen.findByRole("alert")
      ).toHaveTextContent(
        "You do not have permission to download this report."
      );
    });
  
    it("shows a general message when the report download fails", async () => {
      api.get
        .mockResolvedValueOnce({
          data: {
            inspections: [mockInspections[0]],
          },
        })
        .mockRejectedValueOnce(
          new Error("Download failed")
        );
  
      renderHistory();
  
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Download PDF",
        })
      );
  
      expect(
        await screen.findByRole("alert")
      ).toHaveTextContent(
        "We could not download the report. Please try again."
      );
    });
  
    it("disables report download for a failed inspection", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: [
            {
              id: 20,
              created_at:
                "2026-07-04T10:00:00.000Z",
              image_before_path:
                "uploads/failed-before.jpg",
              image_after_path:
                "uploads/failed-after.jpg",
              changes_detected: null,
              status: "failed",
              case_status: "under_review",
            },
          ],
        },
      });
  
      renderHistory();
  
      expect(
        await screen.findByText("Failed")
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("Report unavailable")
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Download PDF",
        })
      ).toBeDisabled();
    });
  
    it("shows pending and processing inspections correctly", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: [
            {
              id: 30,
              created_at:
                "2026-07-05T10:00:00.000Z",
              image_before_path:
                "uploads/pending-before.jpg",
              image_after_path:
                "uploads/pending-after.jpg",
              changes_detected: null,
              status: "pending",
            },
            {
              id: 31,
              created_at:
                "2026-07-06T10:00:00.000Z",
              image_before_path:
                "uploads/processing-before.jpg",
              image_after_path:
                "uploads/processing-after.jpg",
              changes_detected: null,
              status: "processing",
            },
          ],
        },
      });
  
      renderHistory();
  
      expect(
        await screen.findByText("pending")
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("processing")
      ).toBeInTheDocument();
  
      expect(
        screen.getAllByText("Under Review")
      ).toHaveLength(2);
    });
  
    it("uses caseStatus when the backend returns camelCase", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: [
            {
              id: 40,
              created_at:
                "2026-07-07T10:00:00.000Z",
              image_before_path:
                "uploads/camel-before.jpg",
              image_after_path:
                "uploads/camel-after.jpg",
              changes_detected: true,
              status: "completed",
              caseStatus: "dismissed",
            },
          ],
        },
      });
  
      renderHistory();
  
      expect(
        await screen.findByText("Dismissed")
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("Change Detected")
      ).toBeInTheDocument();
    });
  
    it("places dismissed detected changes below pending inspections", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: [
            {
              id: 50,
              created_at:
                "2026-07-08T10:00:00.000Z",
              image_before_path:
                "uploads/dismissed-before.jpg",
              image_after_path:
                "uploads/dismissed-after.jpg",
              changes_detected: true,
              status: "completed",
              case_status: "dismissed",
            },
            {
              id: 51,
              created_at:
                "2026-07-07T10:00:00.000Z",
              image_before_path:
                "uploads/pending-priority-before.jpg",
              image_after_path:
                "uploads/pending-priority-after.jpg",
              changes_detected: null,
              status: "pending",
            },
          ],
        },
      });
  
      renderHistory();
  
      await screen.findAllByAltText("Before inspection");
  
      const rows = screen
        .getAllByRole("row")
        .slice(1);
  
      expect(
        within(rows[0])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("pending-priority-before.jpg");
  
      expect(
        within(rows[1])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("dismissed-before.jpg");
    });
  
    it("places failed or incomplete inspections last", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: [
            {
              id: 60,
              created_at:
                "2026-07-09T10:00:00.000Z",
              image_before_path:
                "uploads/failed-last-before.jpg",
              image_after_path:
                "uploads/failed-last-after.jpg",
              changes_detected: null,
              status: "failed",
            },
            {
              id: 61,
              created_at:
                "2026-07-08T10:00:00.000Z",
              image_before_path:
                "uploads/no-change-before.jpg",
              image_after_path:
                "uploads/no-change-after.jpg",
              changes_detected: false,
              status: "completed",
            },
          ],
        },
      });
  
      renderHistory();
  
      await screen.findAllByAltText("Before inspection");
  
      const rows = screen
        .getAllByRole("row")
        .slice(1);
  
      expect(
        within(rows[0])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("no-change-before.jpg");
  
      expect(
        within(rows[1])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("failed-last-before.jpg");
    });
  
    it("orders inspections with the same priority by newest date first", async () => {
      api.get.mockResolvedValue({
        data: {
          inspections: [
            {
              id: 70,
              created_at:
                "2026-07-01T10:00:00.000Z",
              image_before_path:
                "uploads/older-priority-before.jpg",
              image_after_path:
                "uploads/older-priority-after.jpg",
              changes_detected: true,
              status: "completed",
              case_status: "under_review",
            },
            {
              id: 71,
              created_at:
                "2026-07-10T10:00:00.000Z",
              image_before_path:
                "uploads/newer-priority-before.jpg",
              image_after_path:
                "uploads/newer-priority-after.jpg",
              changes_detected: true,
              status: "completed",
              case_status: "under_review",
            },
          ],
        },
      });
  
      renderHistory();
  
      await screen.findAllByAltText("Before inspection");
  
      const rows = screen
        .getAllByRole("row")
        .slice(1);
  
      expect(
        within(rows[0])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("newer-priority-before.jpg");
  
      expect(
        within(rows[1])
          .getByAltText("Before inspection")
          .getAttribute("src")
      ).toContain("older-priority-before.jpg");
    });
  });