/** Se o modal de configurações está aberto, compartilhado entre a navbar e quem precisa abri-lo. */
export const useSettingsOpen = () => useState('settings-open', () => false)
