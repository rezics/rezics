-- Add value to enum type: "unit_permission"
ALTER TYPE "unit_permission" ADD VALUE 'unit.ownership.transfer' AFTER 'unit.access.manage';
-- Add value to enum type: "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'unit.delete' AFTER 'unit.ownership.transfer';
-- Add value to enum type: "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'unit.restore' AFTER 'unit.delete';
