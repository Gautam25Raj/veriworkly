import { fetchApiData } from "@/utils/fetchApiData";
import type { AmbassadorApplicationPayload } from "@/features/ambassador/types";

export function submitAmbassadorApplication(payload: AmbassadorApplicationPayload) {
  return fetchApiData("/ambassador/apply", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
