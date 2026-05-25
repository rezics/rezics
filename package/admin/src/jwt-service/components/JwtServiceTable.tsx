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
import { useMessage } from "@rezics/i18n/react";
import {
  admin_auth_actions_title,
  admin_auth_email_status,
  admin_jwt_audience,
  admin_jwt_issuer,
  admin_jwt_local,
  admin_jwt_local_issuer,
  admin_jwt_remote,
  admin_jwt_service_key,
  common_active,
  common_edit,
  common_inactive,
} from "@rezics/i18n/messages";
const i18nMessages = {
  admin_auth_actions_title,
  admin_auth_email_status,
  admin_jwt_audience,
  admin_jwt_issuer,
  admin_jwt_local,
  admin_jwt_local_issuer,
  admin_jwt_remote,
  admin_jwt_service_key,
  common_active,
  common_edit,
  common_inactive,
};

type Props = {
  services: JwtServiceDTO[];
  onEdit: (service: JwtServiceDTO) => void;
};

export const JwtServiceTable: FC<Props> = ({ services, onEdit }) => {
  const m = useMessage(i18nMessages);
  return (
    <TooltipProvider>
      <div className="rounded-md border border-border-whisper">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.admin_jwt_service_key()}</TableHead>
              <TableHead>{m.admin_jwt_issuer()}</TableHead>
              <TableHead>{m.admin_jwt_audience()}</TableHead>
              <TableHead>{m.admin_jwt_local_issuer()}</TableHead>
              <TableHead>{m.admin_auth_email_status()}</TableHead>
              <TableHead className="text-right">
                {m.admin_auth_actions_title()}
              </TableHead>
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
                    <Badge className="bg-info-fill text-white">
                      {m.admin_jwt_local()}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{m.admin_jwt_remote()}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {service.isActive ? (
                    <Badge className="bg-success-fill text-white">
                      {m.common_active()}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{m.common_inactive()}</Badge>
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
                          aria-label={m.common_edit()}
                          {...props}
                        >
                          <EditOutlinedIcon className="size-4" />
                        </Button>
                      )}
                    />
                    <TooltipContent>{m.common_edit()}</TooltipContent>
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
