{{/*
Expand the name of the chart.
*/}}
{{- define "skillcanon.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "skillcanon.fullname" -}}
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
{{- define "skillcanon.backend.fullname" -}}
{{- printf "%s-backend" (include "skillcanon.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "skillcanon.frontend.fullname" -}}
{{- printf "%s-frontend" (include "skillcanon.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "skillcanon.database.fullname" -}}
{{- printf "%s-database" (include "skillcanon.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "skillcanon.labels" -}}
helm.sh/chart: {{ include "skillcanon.name" . }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "skillcanon.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "skillcanon.name" . }}
app.kubernetes.io/component: backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "skillcanon.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "skillcanon.name" . }}
app.kubernetes.io/component: frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database selector labels
*/}}
{{- define "skillcanon.database.selectorLabels" -}}
app.kubernetes.io/name: {{ include "skillcanon.name" . }}
app.kubernetes.io/component: database
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database host — use built-in StatefulSet service if enabled, otherwise user-provided host
*/}}
{{- define "skillcanon.database.host" -}}
{{- if .Values.database.enabled }}
{{- include "skillcanon.database.fullname" . }}
{{- else }}
{{- .Values.postgresql.host }}
{{- end }}
{{- end }}

{{/*
Database URL (asyncpg)
*/}}
{{- define "skillcanon.databaseUrl" -}}
postgresql+asyncpg://{{ .Values.postgresql.username }}:{{ .Values.postgresql.password }}@{{ include "skillcanon.database.host" . }}:{{ .Values.postgresql.port }}/{{ .Values.postgresql.database }}
{{- end }}

{{/*
Backend internal URL (for frontend BACKEND_URL)
*/}}
{{- define "skillcanon.backend.url" -}}
http://{{ include "skillcanon.backend.fullname" . }}:{{ .Values.backend.service.port }}
{{- end }}
