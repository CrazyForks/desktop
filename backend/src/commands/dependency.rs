use crate::runtime::blocks::Block;
use crate::runtime::workflow::dependency::DependencySpec;
use eyre::Result;

#[tauri::command]
pub async fn can_run(
    state: tauri::State<'_, crate::state::AtuinState>,
    spec: DependencySpec,
    block: Block,
) -> Result<bool, String> {
    let can_run = spec
        .can_run(&block, state.exec_log())
        .await
        .map_err(|e| e.to_string())?;
    Ok(can_run)
}
