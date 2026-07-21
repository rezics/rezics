-- Every Profile is the root owner of its own Profile Unit.
INSERT INTO unit_access_binding (
    unit_id,
    subject_kind,
    profile_id,
    role,
    scope,
    granted_by_profile_id
)
SELECT
    profile.id,
    'profile',
    profile.id,
    'owner',
    ARRAY[]::text[],
    profile.id
FROM profile
WHERE NOT EXISTS (
    SELECT 1
    FROM unit_access_binding
    WHERE unit_access_binding.unit_id = profile.id
      AND unit_access_binding.role = 'owner'
      AND unit_access_binding.revoked_at IS NULL
);
