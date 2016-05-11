var fs = require('fs')
var request = require('request')
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var cheerio = require('cheerio')
var hyperstream = require('hyperstream')
var h = require('virtual-dom/h')
var createElement = require('virtual-dom/create-element')


app.use(bodyParser.urlencoded({ extended: true })); 

app.post('/search', function(req, res) {
	
	var word = req.body.word
	var apiCall = "http://thesaurus.altervista.org/service.php?word="+word+"&language=en_US&output=json&key=SS3IcLAnzS2CcXXDH6UC"
	request(apiCall, function (err, resp, content){
		var virtualTree
		var result = JSON.parse(content)
		
		// request module failed
		if(err) console.error('err', err)		
		
		// synonym API doesn't have word requested
		if(result.error) virtualTree = h('div', result.error)
		
		// Synonm API found requested word
		else{
			// Reduce result object into a list of synonoms
			var synonyms = result.response.reduce(function(prev, current){
				return prev.concat(current.list.synonyms.split('|'))
			}, [])
				// Fiter out all non-true synonoms
				.filter(function(element){ return element.indexOf('(') === -1 })
			
			var queries = [word].concat(synonyms)
			var resp = crawl(queries, 'files')

			virtualTree = h('div', resp)
		}
		var html = createElement(virtualTree).toString()
		// Create readable stream with index.html
		fs.createReadStream('public/index.html')
			// Pipe html variable into #content div of index.html
			.pipe(hyperstream({
				'#content': html
			}))
			// Pipe new index.html into the response object
			.pipe(res)	
	})
})

// Set /public for startic resources
app.use(express.static(__dirname + '/public'))


// Search 
function crawl(queries, directory) {
	var limit = 140
	var query 
	var pos = 0
	var sentence = ''
	var sentenceBegining
	var sentenceEnd
	var results = []
	var files = fs.readdirSync(directory)
	files.forEach(function(file){
		var data = fs.readFileSync(directory + '/' + file)
		
		// Use jQuery to parse DOM
		var $ = cheerio.load(data);
		// Replace new line characters with ' '
		var text = $('p').text().replace(/\s\s+/g, ' ')
		
		var passed = false

		searchText = text
		
		//check every query (synonmy) until one is found in the current file	
		synonymIterator:
		for(var g = 0; g < queries.length; g++){  
			query = queries[g]		
			
			//check entire file for current querry
			while(searchText.indexOf(query) > -1){	
				pos = searchText.indexOf(query) 
				
				//query is matched somewhere in the file
				if (pos >= 0 ) { 	
					pos += text.length-searchText.length
					var charBefore = text.charAt(pos-1)
					
					//query doesn't have a prefix
					if(charBefore === ' ' || charBefore === "'" || charBefore === '"' || charBefore === '=' || text.charAt(pos) === text.charAt(pos).toUpperCase()){  
						var charAfter = text.charAt(pos + query.length)	
						
						//query dosen't have a suffix
						if(charAfter === ',' || charAfter === '.' || charAfter === ' ' || charAfter === '"' || charAfter === "'" || charAfter === '-' ){  
							// The query match found is actually an instance of the serach word in the file
							passed = true
					
							// Word has been found no need to look furthe in the file or check any more synonoms
							break synonymIterator
						}
					}
				} 
				// The rest of the file after removing the current querry match and everything before it
				searchText = searchText.substring(pos+query.length)
			}
		}	
		if (passed) {
			sentenceBegining = 0
			sentenceEnd = pos + limit
			
			var currentChar = 0
			function isEndChar(currentChar){return currentChar === '.' || currentChar === '?' || currentChar ==='!'}
			
			// Find the end of the previous sentence
			for(var i = pos - 1; i >= 0; i--){
				if (isEndChar(text.charAt(i))) {
					sentenceBegining = i + 2
					break
				}
			}
			// Find the beging of the next sentence
			for (var j = pos + query.length ; j < text.length; j++) {
				if (isEndChar(text.charAt(j))) {
					sentenceEnd = j
					break
				}
			}
			var sentenceLength = sentenceEnd - sentenceBegining
			var charsBefore = pos - sentenceBegining
			var charsAfter = sentenceEnd - pos + query.length
			
			// Sentence is sorter than display limit
			if (sentenceLength <= limit){
				sentence = text.substring(sentenceBegining, sentenceEnd+1)
			} 
			else {
				// Query is in middle of sentence
				if (charsBefore === charsAfter) {
					sentence = text.substring(pos - limit / 2, pos + limit / 2)
					// If too long trim on both ends
					while(sentence.length > limit){
						sentence = sentence.substr(1, sentence.length - 1)
					}
				}
				// More characters before query than after
				else if (charsBefore > charsAfter) {
					sentence = text.substring(sentenceBegining, pos + query.length + 1)
					// If too long trim from begining 
					while(sentence.length > limit){
						sentence = sentence.substr(1)
					}
				}
				// More characters after query than before
				else { 
					sentence = text.substring(pos, sentenceEnd + 1); 
					// If too long trim from end
					while(sentence.length > limit){
						sentence = sentence.substr(0, sentence.length - 1)
					}
				}
			}
			var queryPos = sentence.indexOf(query)

			// Generate virtual DOM node for the query results			
			var virtualNode = h('div', {class: 'item'}, [
				h('div', {class: 'file-name'}, file),
				h('div', [
					sentence.substring(0, queryPos),
					h('span', {class: 'query'}, query),
					sentence.substring(queryPos+query.length),
				])
			])

			// Add the virtual node to the list of results
			results.push(virtualNode)
		}
	})
	// Return a list of virtual DOM nodes to the /search POST route
	return results
}

app.listen(process.env.PORT || 5000, function() {
  console.log('Server running on port 5000');
})
