FROM postgres:16-alpine

COPY init/ /docker-entrypoint-initdb.d/

# OpenShift runs containers as an arbitrary UID in GID 0 (never root).
# The volume mounts at /var/lib/postgresql/data (owned by root).
# By setting PGDATA to a subdirectory, initdb creates it as the runtime
# UID and owns it — satisfying its strict 0700 ownership check.
# The parent dir just needs to be writable by GID 0.
ENV PGDATA=/var/lib/postgresql/data/pgdata

RUN mkdir -p /var/lib/postgresql/data /var/run/postgresql && \
    chown -R postgres:0 /var/lib/postgresql /var/run/postgresql /docker-entrypoint-initdb.d && \
    chmod 0775 /var/lib/postgresql/data /var/run/postgresql && \
    chmod -R g=u /docker-entrypoint-initdb.d

USER 999

EXPOSE 5432
