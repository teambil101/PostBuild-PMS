import { Navigate, useLocation } from "react-router-dom";

/**
 * The Leads module has merged into People. The pipeline now lives at
 * /people?tab=pipeline. Existing /leads bookmarks land there and any
 * filter querystring is preserved.
 */
export default function LeadsRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("tab", "pipeline");
  return <Navigate to={`/people?${params.toString()}`} replace />;
}