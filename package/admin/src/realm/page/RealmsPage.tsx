import {
  Card,
  CardContent,
  Typography,
} from "@mui/material";
import { Page } from "@/core/layout/Page";

// MOCK: realm list page - backend API integration pending
export default function RealmsPage() {
  return (
    <Page title="Realms" description="Manage community realms">
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Realm Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Realm listing and management will be available once the realm admin
            API endpoints are ready. Realms are community spaces that contain
            curated content, tags, and members.
          </Typography>
        </CardContent>
      </Card>
    </Page>
  );
}
