import {
  useActivateJwtServiceMutation,
  useDeactivateJwtServiceMutation,
  useUpdateJwtServiceMutation,
} from "@rezics/api/jwt-service/jwt-service.mutations";
import { jwtServiceQueries } from "@rezics/api/jwt-service/jwt-service.queries";
import type { JwtServiceDTO, UpdateJwtServiceInput } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useEffect, useState } from "react";
import * as m from "@rezics/i18n/messages";
import { JwtServiceEditDialog, JwtServiceTable } from "../components";

export const JwtServicesPage: FC = () => {
  const { data, isLoading, error } = useQuery(jwtServiceQueries.list());

  const [services, setServices] = useState<JwtServiceDTO[]>([]);

  useEffect(() => {
    if (data?.services) setServices(data.services);
  }, [data]);

  const updateMutation = useUpdateJwtServiceMutation();
  const activateMutation = useActivateJwtServiceMutation();
  const deactivateMutation = useDeactivateJwtServiceMutation();

  const [updating, setUpdating] = useState(false);
  const [editingService, setEditingService] = useState<JwtServiceDTO | null>(
    null,
  );
  const [openEdit, setOpenEdit] = useState(false);
  const [updatingError, setUpdatingError] = useState<string | null>(null);

  const handleEdit = (service: JwtServiceDTO) => {
    setEditingService(service);
    setUpdatingError(null);
    setOpenEdit(true);
  };

  const handleUpdate = async (
    serviceKey: string,
    input: UpdateJwtServiceInput,
  ) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      await updateMutation.mutateAsync({ serviceKey, input });
      setOpenEdit(false);
      setEditingService(null);
    } catch (err) {
      setUpdatingError((err as Error)?.message ?? m.admin_jwt_update_failed());
    } finally {
      setUpdating(false);
    }
  };

  const handleActivate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      const updated = await activateMutation.mutateAsync(serviceKey);
      setEditingService(updated);
    } catch (err) {
      setUpdatingError(
        (err as Error)?.message ?? m.admin_jwt_activate_failed(),
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleDeactivate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      const updated = await deactivateMutation.mutateAsync(serviceKey);
      setEditingService(updated);
    } catch (err) {
      setUpdatingError(
        (err as Error)?.message ?? m.admin_jwt_deactivate_failed(),
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="w-11/12 mx-auto mt-16">
      <div className="flex flex-row justify-between items-center">
        <h1 className="text-3xl font-bold mb-8">{m.admin_jwt_title()}</h1>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Spinner />
        </div>
      )}

      {error && (
        <Alert className="mb-4">
          <AlertDescription className="text-error-text">
            {(error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && services.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <p className="text-base text-text-secondary">{m.admin_jwt_empty()}</p>
        </div>
      )}

      {!isLoading && !error && services.length > 0 && (
        <JwtServiceTable services={services} onEdit={handleEdit} />
      )}

      <JwtServiceEditDialog
        open={openEdit}
        service={editingService}
        onClose={() => {
          setOpenEdit(false);
          setEditingService(null);
        }}
        onUpdate={handleUpdate}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        updating={updating}
        error={updatingError}
      />
    </div>
  );
};

export default JwtServicesPage;
