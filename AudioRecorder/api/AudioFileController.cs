
namespace ChaddSutff.Controllers
{
   [RoutePrefix("api/medication")]
    public class AudioFileController : ApiController
    {

      [Route("saveaudio")]
        [HttpPost]
        public bool SaveVoiceNote()
        {
	    var retval= false;
            var payload = HttpContext.Current.Request;
            var audio= StorageServiceTasks.Storage.GetNewAudioFile();
            try
            {
                var postedFile = payload.Files["audio_data"];
                var Id= int.Parse(payload.Form["Id"]);
                
		//Store in Session: TOdo

                //read file to byte[]                
                using (var binaryReader = new BinaryReader(postedFile.InputStream))
                {
                   audio.AudioFile = binaryReader.ReadBytes(postedFile.ContentLength);
                }

                //Add to DB
                var id = 0;
                var rez = StorageServiceTasks.Storage.SaveAudio(audio);
                if (rez.PostStatus == procEnum.PostStatus.Processed)
                {
           	//Any additional processing needed? 
		//log this
		ret_val=true;
                }
            }
            catch (Exception ex)
            {
                ret_val=false;
		// log this ex.Message

            }

            return ret_val;
        }

     }

}