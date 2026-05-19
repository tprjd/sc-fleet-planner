import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./components/LandingPage";
import { FleetPage } from "./components/FleetPage";
import { NotFound } from "./components/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/fleet/:code" element={<FleetPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
