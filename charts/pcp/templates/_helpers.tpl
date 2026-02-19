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
Common labels
*/}}
{{- define "pcp.labels" -}}
helm.sh/chart: {{ include "pcp.name" . }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "pcp.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "pcp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pcp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database URL
*/}}
{{- define "pcp.databaseUrl" -}}
postgresql+asyncpg://{{ .Values.postgresql.username }}:{{ .Values.postgresql.password }}@{{ .Values.postgresql.host }}:{{ .Values.postgresql.port }}/{{ .Values.postgresql.database }}
{{- end }}
