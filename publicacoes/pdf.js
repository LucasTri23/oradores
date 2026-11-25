(function(root){
  async function ler(arquivo){
    if(!arquivo||arquivo.size===0||arquivo.size>10*1024*1024)throw new Error('Escolha um PDF de até 10 MB.');
    const bytes=new Uint8Array(await arquivo.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('O arquivo selecionado não é um PDF válido.');
    const pdfjs=await import('/vendor/pdfjs/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.mjs';
    const task=pdfjs.getDocument({data:bytes,isEvalSupported:false});let doc;try{doc=await task.promise;
      if(doc.numPages>40)throw new Error('O relatório deve ter até 40 páginas.');const linhas=[];
      for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),text=await page.getTextContent();linhas.push(...PublicacoesRegras.linhasPagina(text.items));}
      return PublicacoesRegras.lerMovimento(linhas);
    }finally{await task.destroy();}
  }
  root.PublicacoesPdf={ler};
})(window);
