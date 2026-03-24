import {prisma} from '#/prisma/client';
import {invalidateJwtService} from '@/jwt';
import type {
  CreateJwtServiceInput,
  JwtServiceDTO,
  UpdateJwtServiceInput,
} from '@package/contract';

function mapToDTO(record: {
  id: string;
  serviceKey: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksPath: string;
  isLocalIssuer: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): JwtServiceDTO {
  return {
    id: record.id,
    serviceKey: record.serviceKey,
    issuer: record.issuer,
    audience: record.audience,
    jwksUrl: record.jwksUrl,
    jwksPath: record.jwksPath,
    isLocalIssuer: record.isLocalIssuer,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const jwtServiceAdminService = {
  async list(): Promise<JwtServiceDTO[]> {
    const records = await prisma.jwtService.findMany({
      orderBy: {createdAt: 'asc'},
    });
    return records.map(mapToDTO);
  },

  async fetch(serviceKey: string): Promise<JwtServiceDTO | null> {
    const record = await prisma.jwtService.findUnique({
      where: {serviceKey},
    });
    return record ? mapToDTO(record) : null;
  },

  async create(input: CreateJwtServiceInput): Promise<JwtServiceDTO> {
    const record = await prisma.jwtService.create({
      data: {
        serviceKey: input.serviceKey,
        issuer: input.issuer,
        audience: input.audience,
        jwksUrl: input.jwksUrl,
        jwksPath: input.jwksPath,
        isLocalIssuer: input.isLocalIssuer ?? false,
        isActive: true,
      },
    });
    invalidateJwtService(input.serviceKey);
    return mapToDTO(record);
  },

  async update(
    serviceKey: string,
    input: UpdateJwtServiceInput,
  ): Promise<JwtServiceDTO> {
    const record = await prisma.jwtService.update({
      where: {serviceKey},
      data: {
        ...(input.issuer !== undefined ? {issuer: input.issuer} : {}),
        ...(input.audience !== undefined ? {audience: input.audience} : {}),
        ...(input.jwksUrl !== undefined ? {jwksUrl: input.jwksUrl} : {}),
        ...(input.jwksPath !== undefined ? {jwksPath: input.jwksPath} : {}),
        ...(input.isLocalIssuer !== undefined
          ? {isLocalIssuer: input.isLocalIssuer}
          : {}),
      },
    });
    invalidateJwtService(serviceKey);
    return mapToDTO(record);
  },

  async activate(serviceKey: string): Promise<JwtServiceDTO> {
    const record = await prisma.jwtService.update({
      where: {serviceKey},
      data: {isActive: true},
    });
    invalidateJwtService(serviceKey);
    return mapToDTO(record);
  },

  async deactivate(serviceKey: string): Promise<JwtServiceDTO> {
    const record = await prisma.jwtService.update({
      where: {serviceKey},
      data: {isActive: false},
    });
    invalidateJwtService(serviceKey);
    return mapToDTO(record);
  },
};
