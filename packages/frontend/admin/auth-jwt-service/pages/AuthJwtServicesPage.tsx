import {
  useActivateAuthJwtServiceMutation,
  useDeactivateAuthJwtServiceMutation,
  useRotateAuthJwtServiceMutation,
  useUpdateAuthJwtServiceMutation,
} from "@rezics/contract/api/auth-jwt-service/auth-jwt-service.mutations";
import { authJwtServiceQueries } from "@rezics/contract/api/auth-jwt-service/auth-jwt-service.queries";
import type { JwtServiceDTO, UpdateJwtServiceInput } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Page } from "@/admin/core/layouts/Page";
import {
  JwtServiceEditDialog,
  JwtServiceTable,
} from "../../jwt-service/components";

export const AuthJwtServicesPage: FC = () => {
  const { t } = useTranslation(["admin"]);
  const { data, isLoading, error } = useQuery(authJwtServiceQueries.list());

  const [services, setServices] = useState<JwtServiceDTO[]>([]);

  useEffect(() => {
    if (data?.services) setServices(data.services);
  }, [data]);

  const updateMutation = useUpdateAuthJwtServiceMutation();
  const activateMutation = useActivateAuthJwtServiceMutation();
  const deactivateMutation = useDeactivateAuthJwtServiceMutation();
  const rotateMutation = useRotateAuthJwtServiceMutation();

  const [updating, setUpdating] = useState(false);
  const [updatingServiceKey, setUpdatingServiceKey] = useState<string | null>(
    null,
  );
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
      setUpdatingError((err as Error)?.message ?? t("admin:jwt_update_failed"));
    } finally {
      setUpdating(false);
    }
  };

  const handleActivate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      setUpdatingServiceKey(serviceKey);
      const updated = await activateMutation.mutateAsync(serviceKey);
      setEditingService(updated);
    } catch (err) {
      setUpdatingError(
        (err as Error)?.message ?? t("admin:jwt_activate_failed"),
      );
    } finally {
      setUpdating(false);
      setUpdatingServiceKey(null);
    }
  };

  const handleDeactivate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      setUpdatingServiceKey(serviceKey);
      const updated = await deactivateMutation.mutateAsync(serviceKey);
      setEditingService(updated);
    } catch (err) {
      setUpdatingError(
        (err as Error)?.message ?? t("admin:jwt_deactivate_failed"),
      );
    } finally {
      setUpdating(false);
      setUpdatingServiceKey(null);
    }
  };

  const handleRotate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      setUpdatingServiceKey(serviceKey);
      const updated = await rotateMutation.mutateAsync(serviceKey);
      setEditingService((current) =>
        current?.serviceKey === serviceKey ? updated : current,
      );
    } catch (err) {
      setUpdatingError((err as Error)?.message ?? "Failed to rotate key");
    } finally {
      setUpdating(false);
      setUpdatingServiceKey(null);
    }
  };

  return (
    <Page title={t("admin:jwt_auth_title")}>
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
          <p className="text-base text-text-secondary">
            {t("admin:jwt_auth_empty")}
          </p>
        </div>
      )}

      {!isLoading && !error && services.length > 0 && (
        <JwtServiceTable
          services={services}
          onEdit={handleEdit}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
          onRotate={handleRotate}
          updatingServiceKey={updatingServiceKey}
        />
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
    </Page>
  );
};

export default AuthJwtServicesPage;
