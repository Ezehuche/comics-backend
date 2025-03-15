import * as fs from 'fs';
import path from 'path';
import * as Tesseract from 'tesseract.js';
import PptxGenJS from 'pptxgenjs';
import * as sharp from 'sharp';
import axios from 'axios';
import * as cv from '@techstark/opencv-js';
// import * as cv from './opencv';
import { createCanvas } from 'canvas';
import { uploadToCloudflareR2 } from 'src/utils/upload';
// import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

// const GRID_COLUMNS = 4;
// const GRID_ROWS = 6;
// const SLIDE_WIDTH = 10;
// const SLIDE_HEIGHT = 5.625;
// const GOOGLE_FONT_API_KEY = 'AIzaSyCeuv9sl44N-Mp4egbxiKTrbxz3deyyU6g';

const downloadAndSaveFile = async (
  fileUrl: string,
  localFilePath: string,
): Promise<string> => {
  try {
    // Step 1: Download the file from the URL
    console.log(`Downloading file from ${fileUrl}...`);
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream', // Stream the response data
    });

    // Ensure the directory exists
    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create a writable stream to save the file locally
    const writer = fs.createWriteStream(localFilePath);
    response.data.pipe(writer);

    // Wait for the file to finish writing
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`File saved to ${localFilePath}`);

    return localFilePath;

    // Step 2: Perform operations with the file (e.g., read, process, etc.)
    // For example, read the file content
    const fileContent = fs.readFileSync(localFilePath, 'utf-8');
    console.log('File content:', fileContent);

    // Step 3: Delete the file after use
    console.log(`Deleting file ${localFilePath}...`);
    fs.unlinkSync(localFilePath);
    console.log('File deleted successfully.');
  } catch (error) {
    console.error('Error:', error);
  }
};

const deleteFile = async (
  fileUrl: string,
  localFilePath: string,
): Promise<void> => {};

const createGradientImage = (
  colors: string[],
  direction: 'horizontal' | 'vertical',
): Buffer => {
  const canvas = createCanvas(800, 600); // Adjust the size as needed
  const ctx = canvas.getContext('2d');

  // Create a gradient
  let gradient;
  if (direction === 'horizontal') {
    gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  } else {
    gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  }

  // Add color stops
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });

  // Fill the canvas with the gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Convert the canvas to a buffer
  return canvas.toBuffer('image/png');
};

const detectDominantColors = async (
  image: cv.Mat,
  // mask: cv.Mat,
): Promise<string[]> => {
  const pixelData = image.reshape(1, image.rows * image.cols);
  const pixelData32F = new cv.Mat();
  pixelData.convertTo(pixelData32F, cv.CV_32F);

  // Apply k-means clustering to find dominant colors
  const k = 2; // Number of dominant colors
  const labels = new cv.Mat();
  const centers = new cv.Mat();
  const criteria = new cv.TermCriteria(
    cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER,
    10,
    1.0,
  );
  cv.kmeans(pixelData32F, k, labels, criteria, 10, 0, centers);

  const dominantColors: string[] = [];
  for (let i = 0; i < k; i++) {
    const color = centers.ucharAt(i, 0);
    dominantColors.push(`rgb(${color[2]}, ${color[1]}, ${color[0]})`);
  }

  // Clean up
  pixelData.delete();
  pixelData32F.delete();
  labels.delete();
  centers.delete();

  return dominantColors;
};

const detectBackground = async (
  imageBuffer: Buffer,
): Promise<{
  type: 'color' | 'gradient' | 'image';
  data: string | { colors: string[]; direction: string };
}> => {
  // Decode the image from the buffer
  const imageBase64 = imageBuffer.toString('base64');
  const image = cv.imread(`data:image/png;base64,${imageBase64}`);

  // Resize the image for faster processing
  const resizedImage = new cv.Mat();
  const scaleFactor = 0.5; // Adjust based on performance needs
  cv.resize(
    image,
    resizedImage,
    new cv.Size(0, 0),
    scaleFactor,
    scaleFactor,
    cv.INTER_AREA,
  );

  // Convert to grayscale
  const gray = new cv.Mat();
  cv.cvtColor(resizedImage, gray, cv.COLOR_RGBA2GRAY, 0);

  // Apply edge detection
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);

  // Find contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );

  // Create a mask for the foreground
  const mask = cv.Mat.zeros(resizedImage.rows, resizedImage.cols, cv.CV_8UC1);
  for (let i = 0; i < contours.size(); i++) {
    cv.drawContours(mask, contours, i, new cv.Scalar(255), -1);
  }

  // Invert the mask to get the background
  const backgroundMask = new cv.Mat();
  cv.bitwise_not(mask, backgroundMask);

  // Check if the background is a solid color or gradient
  const uniqueColors = new Set();
  const colorVariationThreshold = 10; // Adjust based on sensitivity
  let isGradient = false;

  for (let i = 0; i < resizedImage.rows; i++) {
    for (let j = 0; j < resizedImage.cols; j++) {
      if (backgroundMask.ucharAt(i, j) === 255) {
        const color = resizedImage.ucharAt(i, j);
        const colorKey = `${color[0]},${color[1]},${color[2]}`;
        if (uniqueColors.size > 0) {
          const firstColor = (Array.from(uniqueColors)[0] as string)
            .split(',')
            .map(Number);
          const colorDiff =
            Math.abs(firstColor[0] - color[0]) +
            Math.abs(firstColor[1] - color[1]) +
            Math.abs(firstColor[2] - color[2]);
          if (colorDiff > colorVariationThreshold) {
            isGradient = true;
            break;
          }
        }
        uniqueColors.add(colorKey);
      }
    }
    if (isGradient) break;
  }

  if (uniqueColors.size === 1) {
    // Background is a solid color
    const color = (Array.from(uniqueColors)[0] as string)
      .split(',')
      .map(Number);
    return {
      type: 'color',
      data: `rgb(${color[2]}, ${color[1]}, ${color[0]})`,
    };
  } else if (isGradient) {
    // Background is a gradient
    const dominantColors = await detectDominantColors(resizedImage);
    // const dominantColors = await detectDominantColors(
    //   resizedImage,
    //   backgroundMask,
    // );
    return {
      type: 'gradient',
      data: { colors: dominantColors, direction: 'horizontal' },
    };
  } else {
    // Background is an image
    const backgroundImage = new cv.Mat();
    resizedImage.copyTo(backgroundImage, backgroundMask);
    const backgroundImageBuffer = Buffer.from(backgroundImage.data);
    return { type: 'image', data: backgroundImageBuffer.toString('base64') };
  }
};

// let googleFonts: string[] = [];

// Step 1: Preprocess the image
const preprocessImage = async (imageUrl: string): Promise<Buffer> => {
  // Step 1: Fetch the image from the URL
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(response.data, 'binary');

  // Step 2: Process the image using sharp
  return sharp(imageBuffer)
    .resize(800) // Resize for better OCR
    .grayscale() // Convert to grayscale
    .normalize() // Enhance contrast
    .toBuffer();
};

// const fetchGoogleFonts = async () => {
//   if (googleFonts.length > 0) return googleFonts; // Avoid multiple API calls

//   try {
//     const response = await axios.get(
//       `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONT_API_KEY}`,
//     );
//     googleFonts = response.data.items.map(
//       (font: { family: string }) => font.family,
//     );
//   } catch (error) {
//     console.error('Failed to fetch Google Fonts:', error);
//   }
//   return googleFonts;
// };

// const findClosestFont = (detectedFont: string, availableFonts: string[]) => {
//   // Check exact match first
//   if (availableFonts.includes(detectedFont)) return detectedFont;

//   // Fallback: Find a close match (basic fuzzy matching)
//   return (
//     availableFonts.find((font) =>
//       font.toLowerCase().includes(detectedFont.toLowerCase()),
//     ) || 'Arial' // Default fallback
//   );
// };

const extractTextWithMetadata = async (
  imageBuffer: Buffer,
): Promise<
  {
    text: string;
    fontSize: number;
    font: string;
    boundingBox: { x: number; y: number; width: number; height: number };
  }[]
> => {
  const gray = cv.cvtColor;
  const {
    data: { text, blocks },
  } = await Tesseract.recognize(imageBuffer, 'eng', {
    logger: (info) => console.log(info), // Optional: Log OCR progress
  });

  //   const {
  //     data: { text, blocks },
  //   } = await Tesseract.recognize(imageBuffer, 'eng', {
  //     logger: (info) => console.log(info), // Optional: Log OCR progress
  //     tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Use automatic page segmentation
  //     tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, // Use LSTM OCR engine
  //   });

  const textElements: {
    text: string;
    fontSize: number;
    font: string;
    boundingBox: { x: number; y: number; width: number; height: number };
  }[] = [];

  // const availableFonts = await fetchGoogleFonts();
  console.log(blocks);
  console.log('Text ', text);

  blocks.forEach((line) => {
    const { text, bbox } = line;
    textElements.push({
      text,
      fontSize: bbox.y1 - bbox.y0, // Use detected font size or default to 12
      // font: findClosestFont(text, availableFonts), // Use detected font or default to Arial
      font: 'Arial',
      boundingBox: {
        x: bbox.x0,
        y: bbox.y0,
        width: bbox.x1 - bbox.x0,
        height: bbox.y1 - bbox.y0,
      },
    });
  });

  return textElements;
};

const detectShapes = (
  imageBuffer: Buffer,
): { type: string; points: number[][] }[] => {
  const imageBase64 = imageBuffer.toString('base64');
  const image = cv.imread(`data:image/png;base64,${imageBase64}`);
  // const imageArray = new Uint8Array(imageBuffer);
  console.log('working image');
  // Decode the image using cv.imdecode
  // const image = cv.imdecode(imageArray);
  console.log(image);
  const gray = new cv.Mat();
  cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY, 0);
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_LIST,
    cv.CHAIN_APPROX_SIMPLE,
  );

  console.log(contours);

  const shapes: { type: string; points: number[][] }[] = [];
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const points: number[][] = Array.from(contour.data32S as Int32Array).map(
      (val, idx, arr) => {
        return [arr[idx * 2], arr[idx * 2 + 1]];
      },
    );
    shapes.push({ type: 'shape', points });
  }

  // Clean up
  image.delete();
  gray.delete();
  edges.delete();
  contours.delete();
  hierarchy.delete();

  return shapes;
};

const detectTablesAndCharts = (
  imageBuffer: Buffer,
): { type: string; boundingBox: number[] }[] => {
  // const image = cv.imread(imageBuffer);
  const imageBase64 = imageBuffer.toString('base64');
  const image = cv.imread(`data:image/png;base64,${imageBase64}`);
  const gray = new cv.Mat();
  cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY, 0);

  // Apply edge detection
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);

  // Detect lines using HoughLinesP
  const lines = new cv.Mat();
  cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 50, 10);

  // Detect contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_LIST,
    cv.CHAIN_APPROX_SIMPLE,
  );

  const detectedRegions: { type: string; boundingBox: number[] }[] = [];

  // Detect tables (look for rectangular contours with many lines)
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const boundingBox = cv.boundingRect(contour);

    // Check if the contour is likely a table (e.g., large rectangular area)
    if (boundingBox.width > 100 && boundingBox.height > 100) {
      detectedRegions.push({
        type: 'table',
        boundingBox: [
          boundingBox.x,
          boundingBox.y,
          boundingBox.width,
          boundingBox.height,
        ],
      });
    }
  }

  // Detect charts (look for circular or irregular shapes)
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const boundingBox = cv.boundingRect(contour);

    // Check if the contour is likely a chart (e.g., circular or irregular shape)
    const area = cv.contourArea(contour);
    const perimeter = cv.arcLength(contour, true);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

    if (
      circularity > 0.7 &&
      boundingBox.width > 50 &&
      boundingBox.height > 50
    ) {
      detectedRegions.push({
        type: 'chart',
        boundingBox: [
          boundingBox.x,
          boundingBox.y,
          boundingBox.width,
          boundingBox.height,
        ],
      });
    }
  }

  // Clean up
  image.delete();
  gray.delete();
  edges.delete();
  lines.delete();
  contours.delete();
  hierarchy.delete();

  return detectedRegions;
};

const extractRegions = (
  imageBuffer: Buffer,
  regions: { type: string; boundingBox: number[] }[],
): { type: string; image: Buffer; boundingBox: number[] }[] => {
  const extractedRegions: {
    type: string;
    image: Buffer;
    boundingBox: number[];
  }[] = [];

  regions.forEach(async (region) => {
    const { boundingBox } = region;
    const [x, y, width, height] = boundingBox;

    // Crop the region from the original image
    const croppedImage = await sharp(imageBuffer)
      .extract({ left: x, top: y, width, height })
      .toBuffer();

    extractedRegions.push({
      type: region.type,
      image: croppedImage,
      boundingBox,
    });
  });

  return extractedRegions;
};

const detectAndExtractImages = (
  imageBuffer: Buffer,
): { image: Buffer; boundingBox: number[] }[] => {
  const imageBase64 = imageBuffer.toString('base64');
  const image = cv.imread(`data:image/png;base64,${imageBase64}`);
  //   const image = cv.imread(imageBuffer);
  const gray = new cv.Mat();
  cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY, 0);
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_LIST,
    cv.CHAIN_APPROX_SIMPLE,
  );

  const extractedImages: { image: Buffer; boundingBox: number[] }[] = [];
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const boundingBox = cv.boundingRect(contour);

    // Extract the region of interest (ROI)
    const roi = image.roi(boundingBox);
    const roiBuffer = Buffer.from(roi.data);
    extractedImages.push({
      image: roiBuffer,
      boundingBox: [
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height,
      ],
    });

    // Clean up
    roi.delete();
  }

  // Clean up
  image.delete();
  gray.delete();
  edges.delete();
  contours.delete();
  hierarchy.delete();

  return extractedImages;
};

const createPptx = async (
  //   textElements: {
  //     text: string;
  //     fontSize: number;
  //     font: string;
  //     boundingBox: { x: number; y: number; width: number; height: number };
  //   }[],
  shapes: { type: string; points: number[][] }[],
  extractedImages: { image: Buffer; boundingBox: number[] }[],
  extractedRegions: { type: string; image: Buffer; boundingBox: number[] }[],
  background: {
    type: 'color' | 'gradient' | 'image';
    data: string | { colors: string[]; direction: string };
  },
): Promise<string> => {
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  if (background.type === 'color') {
    // Set slide background color
    slide.background = { color: background.data as string };
  } else if (background.type === 'gradient') {
    // Create a gradient image
    const gradientData = background.data as {
      colors: string[];
      direction: 'horizontal' | 'vertical';
    };
    const gradientImageBuffer = createGradientImage(
      gradientData.colors,
      gradientData.direction,
    );

    // Set the gradient image as the slide background
    slide.background = { data: gradientImageBuffer.toString('base64') };
  } else if (background.type === 'image') {
    // Set slide background image
    slide.background = { data: background.data as string };
  }

  // Add each text element to the slide with correct position, font size, and font
  //   textElements.forEach((element) => {
  //     slide.addText(element.text, {
  //       x: element.boundingBox.x,
  //       y: element.boundingBox.y,
  //       w: element.boundingBox.width,
  //       h: element.boundingBox.height,
  //       fontFace: element.font,
  //       fontSize: element.fontSize,
  //     });
  //   });

  // Add detected shapes to the slide
  shapes.forEach((shape) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: shape.points[0][0],
      y: shape.points[0][1],
      w: shape.points[1][0] - shape.points[0][0],
      h: shape.points[1][1] - shape.points[0][1],
      fill: { color: 'FFFFFF' },
      line: { color: '000000', width: 1 },
    });
  });

  extractedImages.forEach((img) => {
    slide.addImage({
      data: img.image.toString('base64'),
      x: img.boundingBox[0],
      y: img.boundingBox[1],
      w: img.boundingBox[2],
      h: img.boundingBox[3],
    });
  });

  // Add extracted regions (tables/charts) to the slide
  extractedRegions.forEach((region) => {
    slide.addImage({
      data: region.image.toString('base64'),
      x: region.boundingBox[0],
      y: region.boundingBox[1],
      w: region.boundingBox[2],
      h: region.boundingBox[3],
    });
  });

  const pptOutput = await pptx.write({ outputType: 'nodebuffer' });

  let pptBuffer: Buffer;
  if (pptOutput instanceof Uint8Array) {
    pptBuffer = Buffer.from(pptOutput);
  } else if (typeof pptOutput === 'string') {
    pptBuffer = Buffer.from(pptOutput, 'base64');
  } else {
    throw new Error('Unsupported pptx.write output type');
  }

  const fileName = `presentation-${Date.now()}.pptx`;

  const { location } = await uploadToCloudflareR2(pptBuffer, fileName);

  console.log(location);

  // Save the PPTX file
  pptx.writeFile({ fileName: 'output.pptx' });

  return location;
};

export const main = async (imagePath: string) => {
  // const imagePath = 'input-image.png';

  // Step 1: Preprocess the image
  const imageBuffer = await preprocessImage(imagePath);

  // Step 2: Extract text and approximate font
  //   const textElements = await extractTextWithMetadata(imageBuffer);
  //   console.log('Extracted Text:', textElements);

  // Step 3: Detect shapes and objects
  const shapes = detectShapes(imageBuffer);
  console.log('Detected Shapes:', shapes);

  // Step 5: Detect and extract images
  const extractedImages = detectAndExtractImages(imageBuffer);
  console.log('Extracted Images:', extractedImages);

  // Detect tables and charts as shapes
  const detectedRegions = detectTablesAndCharts(imageBuffer);
  console.log('Detected Regions:', detectedRegions);

  // Extract regions as images
  const extractedRegions = await extractRegions(imageBuffer, detectedRegions);
  console.log('Extracted Regions:', extractedRegions);

  // Detect the background
  const background = await detectBackground(imageBuffer);
  console.log('Detected Background:', background);

  // Step 4: Generate PPTX
  const location = await createPptx(
    // textElements,
    shapes,
    extractedImages,
    extractedRegions,
    background,
  );

  return location;
};

/** 🔹 Step 2: Extract Text Using OCR */
// const extractText = async (imagePath: string) => {
//   const { data } = await Tesseract.recognize(imagePath, 'eng');
//   return data.blocks.map((line) => ({
//     text: line.text,
//     boundingBox: line.bbox,
//   }));
// };

// /** 🔹 Step 3: Convert Bounding Box to PowerPoint Coordinates */
// const mapBoundingBoxToPPT = (
//   boundingBox: number[],
//   slideWidth: number,
//   slideHeight: number,
// ) => {
//   return {
//     x: (boundingBox[0] / 1000) * slideWidth,
//     y: (boundingBox[1] / 1000) * slideHeight,
//     w: ((boundingBox[2] - boundingBox[0]) / 1000) * slideWidth,
//     h: ((boundingBox[3] - boundingBox[1]) / 1000) * slideHeight,
//   };
// };

// /** 🔹 Step 5: Scale Font Size Dynamically */
// const scaleFontSize = (
//   boundingBox: number[],
//   slideWidth: number,
//   slideHeight: number,
// ): number => {
//   const [, y1, , y2] = boundingBox;
//   const boxHeight = (y2 - y1) / 1000;
//   return Math.max(12, Math.min(48, boxHeight * slideHeight * 2));
// };

/** 🔹 Step 6: Snap Elements to a Grid for Better Alignment */
// const snapToGrid = (
//   x: number,
//   y: number,
//   slideWidth: number,
//   slideHeight: number,
// ) => {
//   const gridX =
//     Math.round((x / slideWidth) * GRID_COLUMNS) * (slideWidth / GRID_COLUMNS);
//   const gridY =
//     Math.round((y / slideHeight) * GRID_ROWS) * (slideHeight / GRID_ROWS);
//   return { x: gridX, y: gridY };
// };

/** 🔹 Step 7: Auto-Align Text (Left, Center, Right) */
// function alignElement(
//   position: 'left' | 'center' | 'right',
//   slideWidth: number,
// ) {
//   if (position === 'left') return 0.1 * slideWidth;
//   if (position === 'center') return 0.5 * slideWidth;
//   if (position === 'right') return 0.9 * slideWidth;
// }

// /** 🔹 Step 8: Determine Multi-Column Layout */
// const getColumnCount = (textLength: number): number => {
//   if (textLength < 100) return 1;
//   if (textLength < 300) return 2;
//   return 3;
// };

// const splitTextIntoColumns = (text: string, columns: number): string[] => {
//   const words = text.split(' ');
//   const wordsPerColumn = Math.ceil(words.length / columns);
//   return Array.from({ length: columns }, (_, i) =>
//     words.slice(i * wordsPerColumn, (i + 1) * wordsPerColumn).join(' '),
//   );
// };

// /** 🔹 Step 9: Generate Editable PowerPoint */
// const generatePPT = async (imagePath: string, outputPPT: string) => {
//   const ppt = new pptxgen();
//   const slide = ppt.addSlide();
//   const slideWidth = SLIDE_WIDTH;
//   const slideHeight = SLIDE_HEIGHT;

//   // Process the image
//   const processedImage = await removeBackground(
//     imagePath,
//     'processed_image.png',
//   );
//   const textData = await extractText(processedImage);

//   textData.forEach((line) => {
//     const pptPosition = mapBoundingBoxToPPT(
//       [
//         line.boundingBox.x0,
//         line.boundingBox.y0,
//         line.boundingBox.x1,
//         line.boundingBox.y1,
//       ],
//       slideWidth,
//       slideHeight,
//     );
//     const { x, y } = snapToGrid(
//       pptPosition.x,
//       pptPosition.y,
//       slideWidth,
//       slideHeight,
//     );
//     const fontSize = scaleFontSize(
//       [
//         line.boundingBox.x0,
//         line.boundingBox.y0,
//         line.boundingBox.x1,
//         line.boundingBox.y1,
//       ],
//       slideWidth,
//       slideHeight,
//     );
//     const columnCount = getColumnCount(line.text.length);
//     const columnTexts = splitTextIntoColumns(line.text, columnCount);
//     const columnWidth = slideWidth / columnCount - 0.5;

//     columnTexts.forEach((columnText, index) => {
//       slide.addText(columnText, {
//         x: index * (slideWidth / columnCount),
//         y,
//         w: columnWidth,
//         h: pptPosition.h,
//         fontSize,
//         fontFace: 'Arial',
//         color: '000000',
//         align: 'left',
//       });
//     });
//   });

//   await ppt.writeFile(outputPPT);
//   console.log(`PPT generated: ${outputPPT}`);
// };

// /** 🔹 Step 10: Run Script */
// const imagePath = 'input_image.png';
// const outputPPT = 'output_presentation.pptx';

// generatePPT(imagePath, outputPPT).catch(console.error);
