import {
    fireEvent,
    render,
    screen,
    waitFor,
  } from "@testing-library/react";
  import { beforeEach, describe, expect, it, vi } from "vitest";
  
  import Upload from "./Upload";
  import api from "../api";
  
  // Mock navigation so the test does not change the real browser route.
  const mockNavigate = vi.fn();
  
  vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
  
    return {
      ...actual,
      useNavigate: () => mockNavigate,
    };
  });
  
  // Mock the API client so the tests never contact the real backend.
  vi.mock("../api", () => ({
    default: {
      post: vi.fn(),
    },
  }));
  
  // Mock FileReader so previews are created immediately and predictably.
  class MockFileReader {
    constructor() {
      this.result = "";
      this.onloadend = null;
      this.onerror = null;
    }
  
    readAsDataURL(file) {
      this.result = `data:${file.type};base64,mock-image-data`;
  
      if (this.onloadend) {
        this.onloadend();
      }
    }
  }
  
  // Creates a valid image file for the upload tests.
  const createImageFile = (
    name = "building.png",
    type = "image/png"
  ) =>
    new File(["mock-image-content"], name, {
      type,
    });
  
  // Selects an image through the currently displayed Choose File input.
  const chooseImage = (file) => {
    const input = screen.getByLabelText("Choose File");
  
    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });
  };
  
  // Completes step 1 and moves to the After-image step.
  const completeBeforeStep = async () => {
    chooseImage(createImageFile("before.png"));
  
    await waitFor(() => {
      expect(
        screen.getByAltText("Before preview")
      ).toBeInTheDocument();
    });
  
    fireEvent.click(
      screen.getByRole("button", {
        name: "Next",
      })
    );
  
    expect(
      screen.getByText("2. Upload After Image")
    ).toBeInTheDocument();
  };
  
  // Completes both wizard image-selection steps.
  const completeBothImageSteps = async () => {
    await completeBeforeStep();
  
    chooseImage(createImageFile("after.png"));
  
    await waitFor(() => {
      expect(
        screen.getByAltText("After preview")
      ).toBeInTheDocument();
    });
  };
  
  describe("Upload page", () => {
    beforeEach(() => {
      // Clear previous calls before every test.
      vi.clearAllMocks();
  
      // Replace the browser FileReader with the predictable mock version.
      vi.stubGlobal("FileReader", MockFileReader);
    });
  
    it("renders the first wizard step correctly", () => {
      render(<Upload />);
  
      expect(
        screen.getByRole("heading", {
          name: "Upload Inspection Images",
        })
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("1. Upload Before Image")
      ).toBeInTheDocument();
  
      expect(
        screen.queryByText("2. Upload After Image")
      ).not.toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Next",
        })
      ).toBeDisabled();
    });
  
    it("enables Next after a valid Before image is selected", async () => {
      render(<Upload />);
  
      chooseImage(createImageFile("before.png"));
  
      await waitFor(() => {
        expect(
          screen.getByAltText("Before preview")
        ).toBeInTheDocument();
      });
  
      expect(
        screen.getByRole("button", {
          name: "Next",
        })
      ).toBeEnabled();
    });
  
    it("moves from the Before step to the After step", async () => {
      render(<Upload />);
  
      await completeBeforeStep();
  
      expect(
        screen.queryByText("1. Upload Before Image")
      ).not.toBeInTheDocument();
  
      expect(
        screen.getByText("2. Upload After Image")
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Back",
        })
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      ).toBeDisabled();
    });
  
    it("returns to the Before step and keeps the selected image", async () => {
      render(<Upload />);
  
      await completeBeforeStep();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Back",
        })
      );
  
      expect(
        screen.getByText("1. Upload Before Image")
      ).toBeInTheDocument();
  
      expect(
        screen.getByAltText("Before preview")
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Next",
        })
      ).toBeEnabled();
    });
  
    it("enables Submit Images after both images are selected", async () => {
      render(<Upload />);
  
      await completeBothImageSteps();
  
      expect(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      ).toBeEnabled();
    });
  
    it("rejects an unsupported file type", () => {
      render(<Upload />);
  
      const textFile = new File(
        ["plain text"],
        "document.txt",
        {
          type: "text/plain",
        }
      );
  
      chooseImage(textFile);
  
      expect(
        screen.getByText(
          "Only JPG, PNG, and TIFF image files are allowed."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Next",
        })
      ).toBeDisabled();
    });
  
    it("rejects an image larger than 10MB", () => {
      render(<Upload />);
  
      const largeFile = new File(
        [new Uint8Array(10 * 1024 * 1024 + 1)],
        "large.png",
        {
          type: "image/png",
        }
      );
  
      chooseImage(largeFile);
  
      expect(
        screen.getByText(
          "The selected image must be 10MB or smaller."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Next",
        })
      ).toBeDisabled();
    });
  
    it("uploads both images and navigates to Processing", async () => {
      api.post.mockResolvedValue({
        data: {
          inspectionId: 25,
        },
      });
  
      render(<Upload />);
  
      await completeBothImageSteps();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      );
  
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledTimes(1);
      });
  
      const [url, formData, config] = api.post.mock.calls[0];
  
      expect(url).toBe("/api/inspections/upload");
      expect(formData).toBeInstanceOf(FormData);
  
      expect(formData.get("imageBefore")).toEqual(
        expect.objectContaining({
          name: "before.png",
        })
      );
  
      expect(formData.get("imageAfter")).toEqual(
        expect.objectContaining({
          name: "after.png",
        })
      );
  
      expect(config).toEqual({
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
  
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/processing/25",
          {
            state: {
              inspectionId: 25,
              beforePreview:
                "data:image/png;base64,mock-image-data",
              afterPreview:
                "data:image/png;base64,mock-image-data",
            },
          }
        );
      });
    });
  
    it("supports an API response containing id instead of inspectionId", async () => {
      api.post.mockResolvedValue({
        data: {
          id: 30,
        },
      });
  
      render(<Upload />);
  
      await completeBothImageSteps();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      );
  
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/processing/30",
          expect.objectContaining({
            state: expect.objectContaining({
              inspectionId: 30,
            }),
          })
        );
      });
    });
  
    it("returns to step 2 and shows a message for a 413 response", async () => {
      api.post.mockRejectedValue({
        response: {
          status: 413,
        },
      });
  
      render(<Upload />);
  
      await completeBothImageSteps();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      );
  
      expect(
        await screen.findByText(
          "One or both images are too large."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("2. Upload After Image")
      ).toBeInTheDocument();
  
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  
    it("returns to step 2 and shows a message for a 415 response", async () => {
      api.post.mockRejectedValue({
        response: {
          status: 415,
        },
      });
  
      render(<Upload />);
  
      await completeBothImageSteps();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      );
  
      expect(
        await screen.findByText(
          "Please upload JPG, PNG, or TIFF image files."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("2. Upload After Image")
      ).toBeInTheDocument();
  
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  
    it("returns to step 2 and shows a general upload error", async () => {
      api.post.mockRejectedValue(
        new Error("Network failure")
      );
  
      render(<Upload />);
  
      await completeBothImageSteps();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      );
  
      expect(
        await screen.findByText(
          "We could not upload the images. Please try again."
        )
      ).toBeInTheDocument();
  
      expect(
        screen.getByText("2. Upload After Image")
      ).toBeInTheDocument();
  
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });