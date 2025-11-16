/**
 * Custom Binary Image Codec
 *
 * Encodes connection hashes into binary pixel images and decodes them back.
 * Much simpler and more efficient than QR codes for our use case.
 *
 * Encoding: hash → binary → pixel grid → styled image
 * Decoding: image → pixel grid → binary → hash
 */

/**
 * Convert text to binary string
 */
export function textToBinary(text: string): string {
  let binary = '';

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const binaryChar = charCode.toString(2).padStart(8, '0');
    binary += binaryChar;
  }

  return binary;
}

/**
 * Convert binary string to text
 */
export function binaryToText(binary: string): string {
  let text = '';

  // Process in chunks of 8 bits
  for (let i = 0; i < binary.length; i += 8) {
    const byte = binary.slice(i, i + 8);
    if (byte.length === 8) {
      const charCode = parseInt(byte, 2);
      text += String.fromCharCode(charCode);
    }
  }

  return text;
}

/**
 * Encode hash into a styled image with binary pixel data
 */
export function hashToImage(hash: string, role: 'offer' | 'answer'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // 1. Convert hash to binary
      const binary = textToBinary(hash);

      // 2. Encode data length as 16-bit number for metadata (first 16 bits)
      // This tells us exactly how many bits of actual data to read
      const dataLength = binary.length;
      const dataLengthBinary = dataLength.toString(2).padStart(16, '0');

      // 3. Combine metadata + data
      const fullBinary = dataLengthBinary + binary;

      // 4. Calculate grid size to fit metadata + data
      const totalGridSize = Math.ceil(Math.sqrt(fullBinary.length));

      // 6. Create data canvas (small, contains the actual data)
      const dataCanvas = document.createElement('canvas');
      dataCanvas.width = totalGridSize;
      dataCanvas.height = totalGridSize;
      const dataCtx = dataCanvas.getContext('2d');

      if (!dataCtx) {
        throw new Error('Failed to get canvas context');
      }

      // 7. Draw binary as black/white pixels
      for (let i = 0; i < fullBinary.length; i++) {
        const x = i % totalGridSize;
        const y = Math.floor(i / totalGridSize);
        dataCtx.fillStyle = fullBinary[i] === '1' ? '#FFFFFF' : '#000000';
        dataCtx.fillRect(x, y, 1, 1);
      }

      // 5. Create display canvas (large, with styling)
      const displayCanvas = document.createElement('canvas');
      displayCanvas.width = 600;
      displayCanvas.height = 700;
      const dCtx = displayCanvas.getContext('2d');

      if (!dCtx) {
        throw new Error('Failed to get display canvas context');
      }

      // 6. Draw gradient background
      const gradient = dCtx.createLinearGradient(0, 0, 0, 700);
      gradient.addColorStop(0, role === 'offer' ? '#059669' : '#2563eb');
      gradient.addColorStop(1, role === 'offer' ? '#047857' : '#1e40af');
      dCtx.fillStyle = gradient;
      dCtx.fillRect(0, 0, 600, 700);

      // 7. Draw header
      dCtx.fillStyle = '#fbbf24';
      dCtx.font = 'bold 48px sans-serif';
      dCtx.textAlign = 'center';
      dCtx.fillText('👑 CHAOS CHESS', 300, 70);

      // 8. Draw role subtitle
      dCtx.fillStyle = '#ffffff';
      dCtx.font = 'bold 24px sans-serif';
      const roleText = role === 'offer' ? '🎮 Host Connection Code' : '🔌 Guest Connection Code';
      dCtx.fillText(roleText, 300, 110);

      // 9. Draw border for data area
      dCtx.fillStyle = '#ffffff';
      dCtx.fillRect(15, 135, 570, 570);

      // 10. Draw scaled data image (pixel-perfect scaling)
      dCtx.imageSmoothingEnabled = false;
      dCtx.drawImage(dataCanvas, 20, 140, 560, 560);

      // 11. Draw footer instructions
      dCtx.fillStyle = '#ffffff';
      dCtx.font = '20px sans-serif';
      dCtx.fillText('Share this image to connect', 300, 735);

      dCtx.font = '16px sans-serif';
      dCtx.fillStyle = '#e2e8f0';
      dCtx.fillText('Upload or paste this image in the game', 300, 760);

      // 12. Convert to blob
      displayCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Decode hash from an uploaded image
 */
export function imageToHash(imgFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // 1. Extract data region (the white bordered area containing the data)
        // Data is at position (20, 140, 560, 560) in the 600×700 image
        canvas.width = 560;
        canvas.height = 560;

        // Draw the data region
        ctx.drawImage(img, 20, 140, 560, 560, 0, 0, 560, 560);

        // 2. First, we need to determine the total grid size
        // Try common sizes that our encoder might produce (70-90 range)
        let totalGridSize = 0;
        let fullBinary = '';

        // Try to decode with different grid sizes
        for (let testSize = 70; testSize <= 90; testSize++) {
          const testBinary = extractBinaryFromCanvas(ctx, testSize);

          // First 16 bits should be a valid data length
          const metadataLength = parseInt(testBinary.slice(0, 16), 2);

          // Validate:
          // 1. Data length should be reasonable for our minified hashes (200-800 chars = 1600-6400 bits)
          // 2. Total data (metadata + actual data) should fit in the grid
          const totalDataLength = 16 + metadataLength;
          const gridCapacity = testSize * testSize;

          if (metadataLength >= 1600 &&
              metadataLength <= 6400 &&
              totalDataLength <= gridCapacity &&
              totalDataLength >= (gridCapacity - 200)) { // Should use most of the grid
            totalGridSize = testSize;
            fullBinary = testBinary;
            break;
          }
        }

        if (!totalGridSize) {
          reject(new Error('Failed to decode image - invalid metadata'));
          return;
        }

        // 3. Extract metadata (first 16 bits = data length in bits)
        const dataLength = parseInt(fullBinary.slice(0, 16), 2);

        // 4. Extract actual data (skip first 16 bits, take exactly dataLength bits)
        const dataBinary = fullBinary.slice(16, 16 + dataLength);

        // 5. Convert binary to text
        const hash = binaryToText(dataBinary);

        resolve(hash);

      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(imgFile);
  });
}

/**
 * Helper function to extract binary data from canvas at a specific grid size
 */
function extractBinaryFromCanvas(ctx: CanvasRenderingContext2D, gridSize: number): string {
  // Scale down to data size
  const dataCanvas = document.createElement('canvas');
  dataCanvas.width = gridSize;
  dataCanvas.height = gridSize;
  const dCtx = dataCanvas.getContext('2d');

  if (!dCtx) {
    throw new Error('Failed to get canvas context');
  }

  dCtx.imageSmoothingEnabled = false;
  dCtx.drawImage(ctx.canvas, 0, 0, gridSize, gridSize);

  // Read pixels as binary
  const imageData = dCtx.getImageData(0, 0, gridSize, gridSize);
  let binary = '';

  for (let i = 0; i < imageData.data.length; i += 4) {
    const brightness = imageData.data[i]; // R channel
    binary += brightness < 128 ? '0' : '1';
  }

  return binary;
}

/**
 * Calculate the optimal grid size for a given text length
 */
export function calculateGridSize(text: string): number {
  const binaryLength = text.length * 8;
  return Math.ceil(Math.sqrt(binaryLength));
}
