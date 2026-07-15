import type { MetadataRoute } from "next";

import { pwaManifest } from "@/pwa";

export default function manifest(): MetadataRoute.Manifest {
	return pwaManifest;
}
