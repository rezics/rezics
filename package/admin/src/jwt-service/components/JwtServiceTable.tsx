import type { JwtServiceDTO } from "@rezics/contract";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { Pencil as EditOutlinedIcon } from "lucide-react";
import type { FC } from "react";

type Props = {
  services: JwtServiceDTO[];
  onEdit: (service: JwtServiceDTO) => void;
};

export const JwtServiceTable: FC<Props> = ({ services, onEdit }) => {
  return (
    <TooltipProvider>
      <div className="rounded-md border border-border-whisper">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service Key</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Local Issuer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.serviceKey}>
                <TableCell>
                  <strong>{service.serviceKey}</strong>
                </TableCell>
                <TableCell className="max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {service.issuer}
                </TableCell>
                <TableCell>{service.audience}</TableCell>
                <TableCell>
                  {service.isLocalIssuer ? (
                    <Badge className="bg-info-fill text-white">Local</Badge>
                  ) : (
                    <Badge variant="outline">Remote</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {service.isActive ? (
                    <Badge className="bg-success-fill text-white">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Tooltip>
                    <TooltipTrigger
                      render={(props) => (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onEdit(service)}
                          aria-label="Edit"
                          {...props}
                        >
                          <EditOutlinedIcon className="size-4" />
                        </Button>
                      )}
                    />
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};
