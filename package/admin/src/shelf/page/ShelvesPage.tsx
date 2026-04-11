import {
  Card,
  CardContent,
  Typography,
} from "@mui/material";
import { Page } from "@/core/layout/Page";

// MOCK: shelf list page - backend API integration pending
export default function ShelvesPage() {
  return (
    <Page title="Shelves" description="Manage user shelves">
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Shelf Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Shelf listing and management will be available once the shelf admin
            API endpoints are ready. Shelves are user-created collections that
            organize books and other content.
          </Typography>
        </CardContent>
      </Card>
    </Page>
  );
}
