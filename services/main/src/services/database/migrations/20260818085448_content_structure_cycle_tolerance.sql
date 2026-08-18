SET LOCAL search_path = public;

-- Content Structure consumers terminate independently of parent acyclicity.
-- Keep only the same-Structure parent foreign key; no write performs a graph walk.
DROP TRIGGER content_structure_node_acyclic ON content_structure_node;
DROP FUNCTION content_structure_node_reject_cycle();
ALTER TABLE content_structure_node
    DROP CONSTRAINT content_structure_node_not_self_parent;
