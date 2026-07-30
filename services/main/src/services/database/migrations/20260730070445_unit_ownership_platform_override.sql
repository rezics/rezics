-- Add value to enum type: "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'unit.governance.read' AFTER 'unit.restore';
-- Add value to enum type: "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'unit.ownership.override' AFTER 'unit.governance.read';
