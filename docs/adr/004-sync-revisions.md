# ADR 004: Conflicts are explicit

Mutable records use optimistic `baseRevision`; mismatches return a conflict rather than silently overwriting health history. The first user-facing resolver will preserve both versions.
