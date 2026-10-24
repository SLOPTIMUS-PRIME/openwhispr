// This repository builds a personal local/BYOK client, not a hosted-service client.
export const PERSONAL_FORK = true;

export function personalSetting(key: string, value: string): string {
  if (!PERSONAL_FORK || value !== "openwhispr") return value;
  if (
    /CloudMode$|^cloudTranscriptionMode$|^meetingCloudTranscriptionMode$|^uploadCloudTranscriptionMode$/.test(
      key
    )
  )
    return "byok";
  if (/Mode$/.test(key)) return "providers";
  return value;
}
