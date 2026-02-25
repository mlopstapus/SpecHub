FROM postgres:16-alpine

COPY init/ /docker-entrypoint-initdb.d/

# OpenShift: ensure GID 0 can read/write all needed paths
RUN chmod -R g=u /docker-entrypoint-initdb.d /var/lib/postgresql /var/run/postgresql && \
    chown -R postgres:0 /docker-entrypoint-initdb.d /var/lib/postgresql /var/run/postgresql

EXPOSE 5432
