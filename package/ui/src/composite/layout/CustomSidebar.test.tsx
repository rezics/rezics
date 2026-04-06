import { useState } from "react";
import { useFixtureInput } from "react-cosmos/client";
import { CustomSidebar } from "./CustomSidebar";

export default function CustomSidebarTest() {
  const [props] = useFixtureInput<
    Omit<Parameters<typeof CustomSidebar>[0], "setSection">
  >("Props", {
    section: "Profile",
  });
  const [section, setSection] = useState(props.section);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mb-3 text-sm text-gray-600">
        Current section: {section}
      </div>
      <CustomSidebar section={section} setSection={setSection} />
    </div>
  );
}
