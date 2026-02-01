
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const SYSTEM_INSTRUCTION = `
You are an Elite Biomechanical Sports Analyst. You provide precise, surgical technical feedback.

## ABSOLUTE RULES
- **NO WORD SALAD**: Do not repeat words, list unrelated jargon, or generate long strings of synonyms. 
- **MAX LENGTH**: Each body part feedback string MUST be under 15 words.
- **NO FLUFF**: Zero conversational filler. No "standard for junior player level analysis confirmation" nonsense.
- **SCIENTIFIC ONLY**: Use specific measurements (degrees, widths, alignments).

## FEEDBACK PROTOCOL (STRICT)
For each body part (Head, Shoulders, Arms, Hips, Legs, Footwork):

1. **[PASS] - Elite Technique**:
   - Format: "[PASS] {Metric}: {Value}. {One brief positive remark}."
   - Example: "[PASS] Knee Bend: 112°. Ideal power loading."
   - STATUS: True

2. **[FIX] - Technical Error**:
   - Format: "[FIX] {Metric}: {Value} (Standard: {Range}). {3-5 word instruction}."
   - Example: "[FIX] Elbow: 145° (Standard: 85-95°). Tuck elbow closer to ribs."
   - STATUS: False

3. **DIAGNOSTIC TAGS (bodyPartTags)**:
   - Format: Exactly 2-3 words.
   - Purpose: Extremely concise summary of status + primary reason.
   - Example: "Sufficient rotation", "Over-extended elbow", "Solid base", "Restricted pivot".

4. **STATUS (bodyPartStatuses)**:
   - Boolean value: true if the part has [PASS] technique, false if it has [FIX] errors.

## TEMPORAL DATA
- **timestamp**: Float (e.g., 1.450).
- **displayTime**: "mm:ss:SSS" (e.g., 00:01:450).
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    bodyPartScores: {
      type: Type.OBJECT,
      properties: {
        head: { type: Type.NUMBER },
        shoulders: { type: Type.NUMBER },
        arms: { type: Type.NUMBER },
        hips: { type: Type.NUMBER },
        legs: { type: Type.NUMBER },
        footwork: { type: Type.NUMBER },
      },
      required: ["head", "shoulders", "arms", "hips", "legs", "footwork"]
    },
    timestamps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          frame: { type: Type.INTEGER },
          timestamp: { type: Type.NUMBER },
          displayTime: { type: Type.STRING },
          issue: { type: Type.STRING },
          bodyPartFeedback: { 
            type: Type.OBJECT, 
            properties: {
              Head: { type: Type.STRING },
              Shoulders: { type: Type.STRING },
              Arms: { type: Type.STRING },
              Hips: { type: Type.STRING },
              Legs: { type: Type.STRING },
              Footwork: { type: Type.STRING }
            },
            required: ["Head", "Shoulders", "Arms", "Hips", "Legs", "Footwork"]
          },
          bodyPartTags: {
            type: Type.OBJECT,
            properties: {
              Head: { type: Type.STRING },
              Shoulders: { type: Type.STRING },
              Arms: { type: Type.STRING },
              Hips: { type: Type.STRING },
              Legs: { type: Type.STRING },
              Footwork: { type: Type.STRING }
            },
            required: ["Head", "Shoulders", "Arms", "Hips", "Legs", "Footwork"]
          },
          bodyPartStatuses: {
            type: Type.OBJECT,
            properties: {
              Head: { type: Type.BOOLEAN },
              Shoulders: { type: Type.BOOLEAN },
              Arms: { type: Type.BOOLEAN },
              Hips: { type: Type.BOOLEAN },
              Legs: { type: Type.BOOLEAN },
              Footwork: { type: Type.BOOLEAN }
            },
            required: ["Head", "Shoulders", "Arms", "Hips", "Legs", "Footwork"]
          },
          coachingCues: { type: Type.ARRAY, items: { type: Type.STRING } },
          isPositive: { type: Type.BOOLEAN }
        },
        required: ["frame", "timestamp", "displayTime", "issue", "bodyPartFeedback", "bodyPartTags", "bodyPartStatuses", "coachingCues", "isPositive"]
      }
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["overallScore", "bodyPartScores", "timestamps", "strengths", "weaknesses", "suggestions"]
};

export const analyzeVideo = async (
  videoBase64: string,
  sport: string,
  action: string,
  mimeType: string
): Promise<AnalysisResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `Perform a high-precision biomechanical audit of this ${sport} ${action}. 
    Analyze 4-6 key technical phases.
    For every body part at every marker, provide:
    1. Detailed [PASS]/[FIX] feedback (bodyPartFeedback).
    2. 2-3 word diagnostic tag (bodyPartTags).
    3. Boolean status: true for good technique, false for errors (bodyPartStatuses).`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: videoBase64 } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const cleanedText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanedText) as AnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

/**
 * Step 1: The AI "Director"
 * Extracts coordinates and color statuses using Gemini 3 Pro for higher reliability.
 */
async function getAnnotationCoordinates(
  imageBase64: string,
  sport: string,
  bodyPartTags: Record<string, string>,
  bodyPartStatuses: Record<string, boolean>
): Promise<any[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const bodyPartMappings: Record<string, string> = {
    Head: "head",
    Shoulders: "shoulders",
    Arms: "arms/hands",
    Hips: "hips",
    Legs: "knees/thighs",
    Footwork: "feet/ankles"
  };

  const labelsPrompt = Object.entries(bodyPartTags)
    .filter(([part, tag]) => tag && tag.trim().length > 0 && bodyPartMappings[part])
    .map(([part, tag]) => {
      const isGood = bodyPartStatuses[part];
      return `- Part: ${bodyPartMappings[part]}, Label: "${tag}", Status: ${isGood ? 'PASS' : 'FIX'}`;
    })
    .join("\n");

  const prompt = `
I need precise X/Y percentage coordinates (0-100) for annotation arrows on a ${sport} player.

Target Parts and Labels:
${labelsPrompt}

### BOUNDARY AWARENESS RULES:
- x and y: integer % of image width/height pointing exactly at the body part.
- label_side: Choose 'left' or 'right' so the text box doesn't go off the screen.
- If x < 30, use label_side: 'right'.
- If x > 70, use label_side: 'left'.
- Avoid overlapping boxes.

Return the result as a JSON array of objects.
`.trim();

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            part: { type: Type.STRING },
            label: { type: Type.STRING },
            x: { type: Type.INTEGER },
            y: { type: Type.INTEGER },
            label_side: { type: Type.STRING },
            status: { type: Type.BOOLEAN }
          },
          required: ["part", "label", "x", "y", "label_side", "status"]
        }
      },
      temperature: 0,
    }
  });

  try {
    const text = response.text.replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse coordinates:", e);
    return [];
  }
}

/**
 * Step 2: The Code "Artist"
 * Renders the infographic using Canvas.
 */
async function drawAnnotationsOnCanvas(
  imageBase64: string, 
  annotations: any[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Could not get canvas context");

      ctx.drawImage(img, 0, 0);

      const width = canvas.width;
      const height = canvas.height;
      
      const fontSize = Math.max(10, Math.floor(height * 0.022));
      ctx.font = `${fontSize}px sans-serif`;
      const padding = Math.floor(width * 0.012);
      const arrowOffset = Math.floor(width * 0.1); 

      annotations.forEach(item => {
        const targetX = (item.x / 100) * width;
        const targetY = (item.y / 100) * height;
        const text = item.label;
        const side = item.label_side;
        const isGood = item.status;

        const metrics = ctx.measureText(text);
        const textW = metrics.width;
        const textH = fontSize;
        const boxTotalWidth = textW + (padding * 2);
        const boxTotalHeight = textH + (padding * 2);

        let boxX1, boxX2, arrowStartX;

        if (side === 'left') {
          boxX2 = targetX - arrowOffset;
          boxX1 = boxX2 - boxTotalWidth;
          if (boxX1 < 5) { boxX1 = 5; boxX2 = boxX1 + boxTotalWidth; }
          arrowStartX = boxX2;
        } else {
          boxX1 = targetX + arrowOffset;
          boxX2 = boxX1 + boxTotalWidth;
          if (boxX2 > width - 5) { boxX2 = width - 5; boxX1 = boxX2 - boxTotalWidth; }
          arrowStartX = boxX1;
        }

        let boxY1 = targetY - (textH / 2) - padding;
        if (boxY1 < 5) boxY1 = 5;
        if (boxY1 + boxTotalHeight > height - 5) boxY1 = height - boxTotalHeight - 5;
        const boxY2 = boxY1 + boxTotalHeight;

        // DRAW ARROW
        ctx.strokeStyle = "white";
        ctx.lineWidth = Math.max(2, Math.floor(width * 0.003));
        ctx.beginPath();
        ctx.moveTo(arrowStartX, boxY1 + (boxTotalHeight / 2));
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        // Arrowhead
        ctx.fillStyle = "white";
        ctx.beginPath();
        const headLen = 10;
        if (targetX > arrowStartX) {
          ctx.moveTo(targetX, targetY);
          ctx.lineTo(targetX - headLen, targetY - 5);
          ctx.lineTo(targetX - headLen, targetY + 5);
        } else {
          ctx.moveTo(targetX, targetY);
          ctx.lineTo(targetX + headLen, targetY - 5);
          ctx.lineTo(targetX + headLen, targetY + 5);
        }
        ctx.fill();

        // DRAW BOX
        const radius = 6;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.roundRect(boxX1, boxY1, boxX2 - boxX1, boxY2 - boxY1, radius);
        ctx.fill();

        // DRAW TEXT (Green for GOOD, Red for ERROR)
        ctx.fillStyle = isGood ? "#059669" : "#dc2626";
        ctx.textBaseline = "middle";
        ctx.fillText(text, boxX1 + padding, boxY1 + (boxTotalHeight / 2));
      });

      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = `data:image/jpeg;base64,${imageBase64}`;
  });
}

export const generateVisualCorrection = async (
  imageBase64: string,
  issue: string,
  sport: string,
  bodyPartTags: Record<string, string>,
  bodyPartStatuses: Record<string, boolean>
): Promise<string> => {
  try {
    const annotations = await getAnnotationCoordinates(imageBase64, sport, bodyPartTags, bodyPartStatuses);
    const annotatedImage = await drawAnnotationsOnCanvas(imageBase64, annotations);
    return annotatedImage;
  } catch (error) {
    console.error("Infographic Generation Error:", error);
    throw error;
  }
};
