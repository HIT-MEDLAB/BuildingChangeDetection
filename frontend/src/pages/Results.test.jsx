import {
    act,
    render,
    screen,
    waitFor,
  } from "@testing-library/react";
  import { MemoryRouter, Route, Routes } from "react-router-dom";
  import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
  import api from "../api";
  import Results from "./Results";
  
  // Mock the API module so the tests do not send real HTTP requests
  vi.mock("../api", () => ({
    default: {
      get: vi.fn(),
    },
  }));
  
  // Render the Results component with a valid route parameter
  // and local image previews from the Processing page
  function renderResults() {
    return render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/results/123",
            state: {
              beforePreview: "before-image.jpg",
              afterPreview: "after-image.jpg",
            },
          },
        ]}
      >
        <Routes>
          <Route path="/results/:id" element={<Results />} />
        </Routes>
      </MemoryRouter>
    );
  }
  
  describe("Results component", () => {
    let consoleErrorMock;
  
    beforeEach(() => {
      // Reset all API mocks before every test
      vi.clearAllMocks();
  
      // Hide expected console errors during error-state tests
      consoleErrorMock = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
    });
  
    afterEach(() => {
      // Restore the original console.error implementation
      consoleErrorMock.mockRestore();
    });
  
    // Verify that the loading state is displayed
    // while the backend request is still pending
    test("shows loading state while inspection results are being fetched", () => {
      api.get.mockImplementation(() => new Promise(() => {}));
  
      renderResults();
  
      expect(screen.getByText("Loading results...")).toBeInTheDocument();
    });
  
    // Verify that a clear error message is displayed
    // when the backend request fails
    test("shows error state when the inspection request fails", async () => {
      api.get.mockRejectedValue(new Error("Network error"));
  
      renderResults();
  
      expect(
        await screen.findByText("Failed to load inspection results.")
      ).toBeInTheDocument();
    });
  
    // Verify that the component handles inspections
    // that do not have result data yet
    test("shows an empty state when no inspection results are available", async () => {
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
          "No inspection results are available yet."
        )
      ).toBeInTheDocument();
    });
  
    // Verify that the completed result summary
    // displays the correct number of detected changes
    test("shows the number of detected changes", async () => {
      api.get.mockResolvedValue({
        data: {
          id: "123",
          status: "completed",
          results: {
            changesDetected: true,
            boundingBoxes: [
              { x: 120, y: 85, w: 200, h: 150 },
              { x: 400, y: 300, w: 80, h: 60 },
            ],
          },
        },
      });
  
      renderResults();
  
      expect(
        await screen.findByText("Changes detected: 2")
      ).toBeInTheDocument();
    });
  
    // Verify that every bounding box returned by the backend
    // is rendered over the after image
    test("renders a bounding-box overlay for every detected change", async () => {
      api.get.mockResolvedValue({
        data: {
          id: "123",
          status: "completed",
          results: {
            changesDetected: true,
            boundingBoxes: [
              { x: 120, y: 85, w: 200, h: 150 },
              { x: 400, y: 300, w: 80, h: 60 },
            ],
          },
        },
      });
  
      renderResults();
  
      const afterImage = await screen.findByAltText("After inspection");
  
      // jsdom does not load real images, so define
      // the original image dimensions manually
      Object.defineProperty(afterImage, "naturalWidth", {
        value: 800,
        configurable: true,
      });
  
      Object.defineProperty(afterImage, "naturalHeight", {
        value: 600,
        configurable: true,
      });
  
      // Trigger the image load event inside act
      // because it updates the component state
      await act(async () => {
        afterImage.dispatchEvent(
          new Event("load", {
            bubbles: true,
          })
        );
      });
  
      // Wait until both bounding boxes appear in the document
      await waitFor(() => {
        expect(
          screen.getByLabelText("Detected change 1")
        ).toBeInTheDocument();
  
        expect(
          screen.getByLabelText("Detected change 2")
        ).toBeInTheDocument();
      });
  
      const firstBox = screen.getByLabelText("Detected change 1");  
      // Verify that pixel coordinates were converted
      // into relative percentages correctly
      expect(firstBox).toHaveStyle({
        left: "15%",
        top: "14.166666666666666%",
        width: "25%",
        height: "25%",
      });
    });
  });