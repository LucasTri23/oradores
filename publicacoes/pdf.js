(function(root){
  async function linhas(arquivo,maxPaginas=40){
    if(!arquivo||arquivo.size===0||arquivo.size>10*1024*1024)throw new Error('Escolha um PDF de até 10 MB.');
    const bytes=new Uint8Array(await arquivo.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('O arquivo selecionado não é um PDF válido.');
    const pdfjs=await import('/vendor/pdfjs/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.mjs';
    const task=pdfjs.getDocument({data:bytes,isEvalSupported:false});let doc;try{doc=await task.promise;
      if(doc.numPages>maxPaginas)throw new Error('O PDF deve ter até '+maxPaginas+' páginas.');const out=[];
      for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),text=await page.getTextContent();out.push(...PublicacoesRegras.linhasPagina(text.items));}
      return out;
    }finally{await task.destroy();}
  }
  const ler=async arquivo=>PublicacoesRegras.lerMovimento(await linhas(arquivo));
  const lerHistorico=async arquivo=>PublicacoesRegras.lerHistoricoHub(await linhas(arquivo,100));
  root.PublicacoesPdf={ler,lerHistorico};
})(window);
