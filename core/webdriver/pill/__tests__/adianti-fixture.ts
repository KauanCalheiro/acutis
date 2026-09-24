/** Tela de listagem gerada pelo Adianti, com ids regerados a cada carregamento. */
export const HTML = `
<form class="form-horizontal" type="bootstrap" enctype="multipart/form-data" name="formCentroCustoMostraFuncaoCartaoInstitucionalList" id="formCentroCustoMostraFuncaoCartaoInstitucionalList" method="post">
<div class="panel-body" style="width: 100%"><div class="tab-content"><div role="tabpanel" class="tab-pane active" id="tab_bform_1794557450_0"><div class="form-group tformrow ">
<div class="col-sm-4 fb-field-container ">
<div class="fb-inline-field-container "><label class=" " id="tlabel_1375830931">Código</label>
</div>
<div class="fb-inline-field-container form-line"><input class="form-control tfield" widget="tentry" type="text" name="id" id="tentry_1409028412"></div>
</div>
<div class="col-sm-6 fb-field-container ">
<div class="fb-inline-field-container "><label class=" " id="tlabel_1757158167">Centro de Custo</label>
</div>
<div class="fb-inline-field-container form-line"><select class="form-control tcombo select2-hidden-accessible" widget="tdbuniquesearch" component="multisearch" height="-3" name="ref_centro_custo" id="tdbmultisearch_1987664670" data-select2-id="tdbmultisearch_1987664670" tabindex="-1" aria-hidden="true"><option value="" data-select2-id="20"></option>
</select><span class="select2 select2-container select2-container--default" dir="ltr" data-select2-id="19"><span class="selection"><span class="select2-selection select2-selection--single" role="combobox" aria-haspopup="true" aria-expanded="false" tabindex="0" aria-disabled="false" aria-labelledby="select2-tdbmultisearch_1987664670-container"><span class="select2-selection__rendered" id="select2-tdbmultisearch_1987664670-container" role="textbox" aria-readonly="true"><span class="select2-selection__placeholder">Buscar</span></span><span class="select2-selection__arrow" role="presentation"><b role="presentation"></b></span></span></span><span class="dropdown-wrapper" aria-hidden="true"></span></span></div>
</div>
</div>
</div>
</div>
</div>
<div class="panel-footer" style="width: 100%">
<button id="tbutton_btn_buscar" name="btn_buscar" class="btn btn-default btn-sm" aria-label="Buscar"><span>
<i class="fa fa-search blue"></i>
Buscar</span>
</button>
<button id="tbutton_btn_cadastrar" name="btn_cadastrar" class="btn btn-default btn-sm" aria-label="Cadastrar"><span>
<i class="fa fa-plus green"></i>
Cadastrar</span>
</button>
<button id="tbutton_btn_voltar" name="btn_voltar" class="btn btn-default btn-sm" aria-label="Voltar"><span>
<i class="fa fa-arrow-left blue"></i>
Voltar</span>
</button>
</div>
</form>
`

function combo(name: string, id: string): string {
  return `<div class="form-group tformrow"><div class="fb-inline-field-container form-line">`
    + `<select class="form-control tcombo select2-hidden-accessible" name="${name}" id="${id}" tabindex="-1" aria-hidden="true"><option value=""></option></select>`
    + `<span class="select2 select2-container select2-container--default" dir="ltr"><span class="selection">`
    + `<span class="select2-selection select2-selection--single" role="combobox" aria-labelledby="select2-${id}-container">`
    + `<span class="select2-selection__rendered" id="select2-${id}-container" role="textbox" aria-readonly="true">`
    + `<span class="select2-selection__placeholder">Buscar</span></span></span></span></span></div></div>`
}

/** Dois combos select2 do Adianti na mesma tela, o primeiro com o dropdown aberto. */
export const DOIS_COMBOS = `
<form name="form_equivalencia_aproveitamento" id="form_equivalencia_aproveitamento">
${combo('aluno_origem', 'tdbmultisearch_1982232637')}
${combo('curriculo_destino', 'tmultisearch_1281792668')}
</form>
`

/** O combo com a lista de resultados aberta: o option escondido repete o texto da opção visível. */
export const COMBO_COM_RESULTADOS = `
<select class="select2-hidden-accessible" name="curriculo_destino" tabindex="-1" aria-hidden="true">
<option value=""></option><option value="481221">481221 Engenharia de Software</option><option value="481206">481206 Engenharia de Computação</option>
</select>
<span class="select2-container select2-container--open"><span class="select2-dropdown"><span class="select2-results">
<ul class="select2-results__options" role="listbox">
<li class="select2-results__option select2-results__option--highlighted" role="option">481221 Engenharia de Software</li>
<li class="select2-results__option" role="option">481206 Engenharia de Computação</li>
</ul></span></span></span>
`
