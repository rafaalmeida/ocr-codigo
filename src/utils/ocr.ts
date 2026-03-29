const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

export interface TextBlock {
  text: string;
  confidence: number;
}

export async function recognizeText(
  base64Image: string,
  apiKey: string
): Promise<TextBlock[]> {
  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION', maxResults: 50 }],
      },
    ],
  };

  const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro na API Vision: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const annotations = data.responses?.[0]?.textAnnotations;

  if (!annotations || annotations.length === 0) {
    return [];
  }

  // Skip first annotation (full text), return individual blocks
  return annotations.slice(1).map((annotation: any) => ({
    text: annotation.description.trim(),
    confidence: annotation.confidence ?? 1,
  }));
}

export function extractFullText(
  base64Image: string,
  apiKey: string
): Promise<string> {
  return fetch(`${VISION_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        },
      ],
    }),
  })
    .then(res => res.json())
    .then(data => {
      const fullText = data.responses?.[0]?.textAnnotations?.[0]?.description;
      return fullText?.trim() ?? '';
    });
}
