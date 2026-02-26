{{/*
Expand the name of the chart.
*/}}
{{- define "pcp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "pcp.fullname" -}}
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
{{- define "pcp.backend.fullname" -}}
{{- printf "%s-backend" (include "pcp.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "pcp.frontend.fullname" -}}
{{- printf "%s-frontend" (include "pcp.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "pcp.database.fullname" -}}
{{- printf "%s-database" (include "pcp.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "pcp.labels" -}}
helm.sh/chart: {{ include "pcp.name" . }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "pcp.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pcp.name" . }}
app.kubernetes.io/component: backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "pcp.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pcp.name" . }}
app.kubernetes.io/component: frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database selector labels
*/}}
{{- define "pcp.database.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pcp.name" . }}
app.kubernetes.io/component: database
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database host — use built-in StatefulSet service if enabled, otherwise user-provided host
*/}}
{{- define "pcp.database.host" -}}
{{- if .Values.database.enabled }}
{{- include "pcp.database.fullname" . }}
{{- else }}
{{- .Values.postgresql.host }}
{{- end }}
{{- end }}

{{/*
Database URL (asyncpg)
*/}}
{{- define "pcp.databaseUrl" -}}
postgresql+asyncpg://{{ .Values.postgresql.username }}:{{ .Values.postgresql.password }}@{{ include "pcp.database.host" . }}:{{ .Values.postgresql.port }}/{{ .Values.postgresql.database }}
{{- end }}

{{/*
Backend internal URL (for frontend BACKEND_URL)
*/}}
{{- define "pcp.backend.url" -}}
http://{{ include "pcp.backend.fullname" . }}:{{ .Values.backend.service.port }}
{{- end }}
