import {
    fireEvent,
    render,
    screen,
    waitFor,
  } from "@testing-library/react";
  import { beforeEach, describe, expect, it, vi } from "vitest";
  
  import Upload from "./Upload";
  import api from "../api";
  
  // Mock the navigation function so tests do not change the browser page.
  const mockNavigate = vi.fn();
  
  vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
  
    return {
      ...actual,
      useNavigate: () => mockNavigate,
    };
  });
  
  // Mock the API client so tests do not send real backend requests.
  vi.mock("../api", () => ({
    default: {
      post: vi.fn(),
    },
  }));
  
  // Mock FileReader so image previews are created immediately in tests.
  class MockFileReader {
    constructor() {
      this.result = "";
      this.onloadend = null;
    }
  
    readAsDataURL(file) {
      this.result = `data:${file.type};base64,mock-image-data`;
  
      if (this.onloadend) {
        this.onloadend();
      }
    }
  }
  
  // Creates a valid image file for upload tests.
  const createImageFile = (
    name = "building.png",
    type = "image/png"
  ) => {
    return new File(["mock-image-content"], name, {
      type,
    });
  };
  
  // Returns the two file inputs displayed on the Upload page.
  const getFileInputs = () => {
    return screen.getAllByLabelText("Choose File");
  };
  
  describe("Upload page", () => {
    beforeEach(() => {
      // Clear previous mock calls before every test.
      vi.clearAllMocks();
  
      // Replace the browser FileReader with the predictable test version.
      vi.stubGlobal("FileReader", MockFileReader);
    });
  
    it("renders the upload page correctly", () => {
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
        screen.getByText("2. Upload After Image")
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      ).toBeDisabled();
    });
  
    it("keeps the submit button disabled when only one image is selected", async () => {
      render(<Upload />);
  
      const [beforeInput] = getFileInputs();
      const beforeFile = createImageFile("before.png");
  
      fireEvent.change(beforeInput, {
        target: {
          files: [beforeFile],
        },
      });
  
      await waitFor(() => {
        expect(
          screen.getByAltText("Before preview")
        ).toBeInTheDocument();
      });
  
      expect(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      ).toBeDisabled();
    });
  
    it("enables the submit button after both images are selected", async () => {
      render(<Upload />);
  
      const [beforeInput, afterInput] = getFileInputs();
  
      const beforeFile = createImageFile("before.png");
      const afterFile = createImageFile("after.png");
  
      fireEvent.change(beforeInput, {
        target: {
          files: [beforeFile],
        },
      });
  
      fireEvent.change(afterInput, {
        target: {
          files: [afterFile],
        },
      });
  
      await waitFor(() => {
        expect(
          screen.getByAltText("Before preview")
        ).toBeInTheDocument();
  
        expect(
          screen.getByAltText("After preview")
        ).toBeInTheDocument();
      });
  
      expect(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      ).toBeEnabled();
    });
  
    it("rejects a file that is not an image", () => {
      render(<Upload />);
  
      const [beforeInput] = getFileInputs();
  
      const textFile = new File(
        ["plain text"],
        "document.txt",
        {
          type: "text/plain",
        }
      );
  
      fireEvent.change(beforeInput, {
        target: {
          files: [textFile],
        },
      });
  
      expect(
        screen.getByText("Only image files are allowed")
      ).toBeInTheDocument();
  
      expect(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      ).toBeDisabled();
    });
  
    it("uploads both images and navigates to the processing page", async () => {
      api.post.mockResolvedValue({
        data: {
          inspectionId: 25,
        },
      });
  
      render(<Upload />);
  
      const [beforeInput, afterInput] = getFileInputs();
  
      const beforeFile = createImageFile("before.png");
      const afterFile = createImageFile("after.png");
  
      fireEvent.change(beforeInput, {
        target: {
          files: [beforeFile],
        },
      });
  
      fireEvent.change(afterInput, {
        target: {
          files: [afterFile],
        },
      });
  
      const submitButton = screen.getByRole("button", {
        name: "Submit Images",
      });
  
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      });
  
      fireEvent.click(submitButton);
  
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledTimes(1);
      });
  
      expect(api.post).toHaveBeenCalledWith(
        "/api/inspections/upload",
        expect.any(FormData),
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
  
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
  
    it("supports a backend response that returns id instead of inspectionId", async () => {
      api.post.mockResolvedValue({
        data: {
          id: 30,
        },
      });
  
      render(<Upload />);
  
      const [beforeInput, afterInput] = getFileInputs();
  
      fireEvent.change(beforeInput, {
        target: {
          files: [createImageFile("before.png")],
        },
      });
  
      fireEvent.change(afterInput, {
        target: {
          files: [createImageFile("after.png")],
        },
      });
  
      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Submit Images",
          })
        ).toBeEnabled();
      });
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      );
  
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/processing/30",
          expect.any(Object)
        );
      });
    });
  
    it("shows a friendly message when the images are too large", async () => {
      api.post.mockRejectedValue({
        response: {
          status: 413,
        },
      });
  
      render(<Upload />);
  
      const [beforeInput, afterInput] = getFileInputs();
  
      fireEvent.change(beforeInput, {
        target: {
          files: [createImageFile("before.png")],
        },
      });
  
      fireEvent.change(afterInput, {
        target: {
          files: [createImageFile("after.png")],
        },
      });
  
      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Submit Images",
          })
        ).toBeEnabled();
      });
  
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
  
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  
    it("shows a friendly message for an unsupported file response", async () => {
      api.post.mockRejectedValue({
        response: {
          status: 415,
        },
      });
  
      render(<Upload />);
  
      const [beforeInput, afterInput] = getFileInputs();
  
      fireEvent.change(beforeInput, {
        target: {
          files: [createImageFile("before.png")],
        },
      });
  
      fireEvent.change(afterInput, {
        target: {
          files: [createImageFile("after.png")],
        },
      });
  
      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Submit Images",
          })
        ).toBeEnabled();
      });
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit Images",
        })
      );
  
      expect(
        await screen.findByText(
          "Please upload a supported image file."
        )
      ).toBeInTheDocument();
    });
  
    it("shows a general message when the upload request fails", async () => {
      api.post.mockRejectedValue(
        new Error("Network failure")
      );
  
      render(<Upload />);
  
      const [beforeInput, afterInput] = getFileInputs();
  
      fireEvent.change(beforeInput, {
        target: {
          files: [createImageFile("before.png")],
        },
      });
  
      fireEvent.change(afterInput, {
        target: {
          files: [createImageFile("after.png")],
        },
      });
  
      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Submit Images",
          })
        ).toBeEnabled();
      });
  
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
  
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });