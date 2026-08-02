#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
work_directory="$(mktemp -d)"
readonly work_directory
trap 'rm -rf "${work_directory}"' EXIT

readonly evaluation_id=63663e28-9869-40d3-8a6e-23f7c915ff2a
readonly command_log="${work_directory}/nomad-commands"
readonly apply_output="${work_directory}/apply-output"
readonly fake_nomad="${work_directory}/nomad"
readonly jobspec="${work_directory}/job.nomad.hcl"

cat >"${fake_nomad}" <<'FAKE_NOMAD'
#!/usr/bin/env bash

set -euo pipefail

printf '%q ' "$@" >>"${NOMAD_COMMAND_LOG}"
printf '\n' >>"${NOMAD_COMMAND_LOG}"

case "$1 $2" in
	'job plan')
		printf '%s\n' 'Job Modify Index: 42'
		exit 1
		;;
	'job run')
		printf '%s\n' \
			'Job registration successful' \
			'Evaluation ID: 63663e28-9869-40d3-8a6e-23f7c915ff2a'
		;;
	'eval status')
		if [[ " $* " == *' -json '* ]]; then
			printf '%s\n' '{"Status":"complete","FailedTGAllocs":null}'
		else
			printf '%s\n' \
				'==> 2026-08-02T15:48:20Z: Monitoring evaluation "63663e28"' \
				'==> 2026-08-02T15:48:20Z: Evaluation "63663e28" finished with status "complete"' \
				'==> 2026-08-02T15:48:20Z: Monitoring deployment "must-not-block-apply"'
		fi
		;;
	*)
		printf 'Unexpected Nomad command: %s\n' "$*" >&2
		exit 1
		;;
esac
FAKE_NOMAD
chmod 0700 "${fake_nomad}"
: >"${jobspec}"

NOMAD_BIN="${fake_nomad}" NOMAD_COMMAND_LOG="${command_log}" \
	"${repository_root}/deploy/scripts/apply-nomad-job.sh" "${jobspec}" \
	>"${apply_output}"

if ! grep -Fqx \
	"eval status -no-color -namespace=\\* -monitor ${evaluation_id} " \
	"${command_log}"; then
	printf '%s\n' \
		'Nomad evaluation event monitor did not query every authorized namespace' >&2
	exit 1
fi

if ! grep -Fqx \
	"eval status -json -namespace=\\* ${evaluation_id} " \
	"${command_log}"; then
	printf '%s\n' \
		'Nomad evaluation result was not verified after the terminal event' >&2
	exit 1
fi

if grep -Fq 'must-not-block-apply' "${apply_output}"; then
	printf '%s\n' \
		'Nomad evaluation event monitor followed the deployment stream' >&2
	exit 1
fi

for event_wait_script in \
	deploy/scripts/wait-nomad-batch.sh \
	deploy/scripts/wait-nomad-deployment.sh; do
	if ! grep -Fq -- '-X GET' "${repository_root}/${event_wait_script}"; then
		printf 'Nomad event wait must explicitly use GET: %s\n' \
			"${event_wait_script}" >&2
		exit 1
	fi
done

if ! grep -Fq 'topic=Allocation:*' \
	"${repository_root}/deploy/scripts/wait-nomad-batch.sh"; then
	printf '%s\n' 'Nomad batch wait must subscribe to allocation events' >&2
	exit 1
fi
if ! grep -Fq 'topic=Deployment:*' \
	"${repository_root}/deploy/scripts/wait-nomad-deployment.sh"; then
	printf '%s\n' 'Nomad deployment wait must subscribe to deployment events' >&2
	exit 1
fi
for event_wait_script in \
	deploy/scripts/wait-nomad-batch.sh \
	deploy/scripts/wait-nomad-deployment.sh; do
	if ! grep -Fq 'first(' "${repository_root}/${event_wait_script}" ||
		! grep -Fq 'inputs |' "${repository_root}/${event_wait_script}"; then
		printf 'Nomad event wait must close its stream at terminal state: %s\n' \
			"${event_wait_script}" >&2
		exit 1
	fi
done

printf '%s\n' 'Validated terminal Nomad evaluation event monitoring'
