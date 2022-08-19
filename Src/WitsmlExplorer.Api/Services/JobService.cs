using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

using WitsmlExplorer.Api.Models;
using WitsmlExplorer.Api.Workers;

namespace WitsmlExplorer.Api.Services
{
    public interface IJobService
    {
        Task<string> CreateJob(JobType jobType, Stream httpRequestBody);
    }

    public class JobService : IJobService
    {
        private readonly IJobQueue _jobQueue;
        private readonly IEnumerable<IWorker> _workers;

        public JobService(IJobQueue jobQueue, IEnumerable<IWorker> workers)
        {
            _jobQueue = jobQueue;
            _workers = workers;
        }

        public async Task<string> CreateJob(JobType jobType, Stream jobStream)
        {
            var worker = _workers.FirstOrDefault(worker => worker.JobType == jobType);
            if (worker == null)
                throw new ArgumentOutOfRangeException(nameof(jobType), jobType, $"No worker setup to execute {jobType}");

            var (task, job) = await worker.SetupWorker(jobStream);
            _jobQueue.Enqueue(task);
            return job.JobInfo.Id;
        }
    }
}
