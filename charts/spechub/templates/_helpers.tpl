{{/*
Expand the name of the chart.
*/}}
{{- define "spechub.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "spechub.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Component-qualified names
*/}}
{{- define "spechub.backend.fullname" -}}
{{- printf "%s-backend" (include "spechub.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "spechub.frontend.fullname" -}}
{{- printf "%s-frontend" (include "spechub.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "spechub.database.fullname" -}}
{{- printf "%s-database" (include "spechub.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "spechub.labels" -}}
helm.sh/chart: {{ include "spechub.name" . }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "spechub.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "spechub.name" . }}
app.kubernetes.io/component: backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "spechub.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "spechub.name" . }}
app.kubernetes.io/component: frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database selector labels
*/}}
{{- define "spechub.database.selectorLabels" -}}
app.kubernetes.io/name: {{ include "spechub.name" . }}
app.kubernetes.io/component: database
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database host — use built-in StatefulSet service if enabled, otherwise user-provided host
*/}}
{{- define "spechub.database.host" -}}
{{- if .Values.database.enabled }}
{{- include "spechub.database.fullname" . }}
{{- else }}
{{- .Values.postgresql.host }}
{{- end }}
{{- end }}

{{/*
Database URL (asyncpg)
*/}}
{{- define "spechub.databaseUrl" -}}
postgresql+asyncpg://{{ .Values.postgresql.username }}:{{ .Values.postgresql.password }}@{{ include "spechub.database.host" . }}:{{ .Values.postgresql.port }}/{{ .Values.postgresql.database }}
{{- end }}

{{/*
Backend internal URL (for frontend BACKEND_URL)
*/}}
{{- define "spechub.backend.url" -}}
http://{{ include "spechub.backend.fullname" . }}:{{ .Values.backend.service.port }}
{{- end }}
